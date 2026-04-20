import * as net from 'net';
import * as tls from 'tls';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { URL } from 'url';

export interface WebSocketClientOptions {
  /** Additional headers to send during the HTTP upgrade handshake (e.g., Authorization) */
  headers?: Record<string, string>;
  /** Set to true to allow self-signed or invalid TLS certificates on wss:// connections */
  allowInsecure?: boolean;
  /** A single protocol string or an array of subprotocol strings to negotiate */
  protocols?: string | string[];
}

const MAX_FRAME_SIZE = 64 * 1024 * 1024; // 64 MiB

export class WebSocketClient extends EventEmitter {
  public protocol: string = ''; // Holds the server-selected subprotocol after connection

  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private isHandshakeComplete = false;
  private expectedAcceptKey = '';
  private closed: boolean = false;

  constructor(private url: string, private options: WebSocketClientOptions = {}) {
    super();
  }

  public connect(): void {
    const parsedUrl = new URL(this.url);
    const isWss = parsedUrl.protocol === 'wss:';
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isWss ? 443 : 80);
    const host = parsedUrl.hostname;

    const connectOptions: tls.ConnectionOptions & net.TcpNetConnectOpts = { host, port };

    if (isWss) {
      if (this.options.allowInsecure !== undefined) {
        connectOptions.rejectUnauthorized = !this.options.allowInsecure;
      }
      this.socket = tls.connect(connectOptions, () => this.performHandshake(parsedUrl));
    } else {
      this.socket = net.connect(connectOptions, () => this.performHandshake(parsedUrl));
    }

    this.socket.on('data', (data) => this.handleData(data));
    this.socket.on('error', (err) => this.emit('error', err));
    this.socket.on('close', () => {
      this.cleanup(true);
    });
  }

  public send(data: string | Buffer): void {
    if (!this.socket || !this.isHandshakeComplete) {
      throw new Error('WebSocket is not connected');
    }

    const isBinary = Buffer.isBuffer(data);
    const payload = isBinary ? data : Buffer.from(data as string, 'utf8');
    const length = payload.length;

    let headerLength = 2; // FIN/Opcode + Mask/Length
    let lengthByte = 0;

    if (length < 126) {
      lengthByte = length;
    } else if (length <= 0xFFFF) {
      lengthByte = 126;
      headerLength += 2;
    } else {
      lengthByte = 127;
      headerLength += 8;
    }

    // RFC 6455 Section 5.1: Client frames must be masked randomly
    const maskKey = crypto.randomBytes(4);
    headerLength += 4;

    const frame = Buffer.alloc(headerLength + length);

    // FIN = 1 (0x80) | Opcode = 1 (0x01) for text, 2 (0x02) for binary
    frame[0] = 0x80 | (isBinary ? 0x02 : 0x01);

    // Mask bit = 1 (0x80) | Payload length
    frame[1] = 0x80 | lengthByte;

    let offset = 2;
    if (lengthByte === 126) {
      frame.writeUInt16BE(length, offset);
      offset += 2;
    } else if (lengthByte === 127) {
      frame.writeBigUInt64BE(BigInt(length), offset);
      offset += 8;
    }

    maskKey.copy(frame, offset);
    offset += 4;

    // Mask the payload
    for (let i = 0; i < length; i++) {
      frame[offset + i] = payload[i] ^ maskKey[i % 4];
    }

    this.socket.write(frame);
  }

  private cleanup(shouldEmitClose: boolean): void {
    if (this.closed) return;
    this.closed = true;

    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }

    if (shouldEmitClose) {
      this.emit('close');
    }
  }

  public close(shouldEmitClose = true): void {
    if (this.socket && this.isHandshakeComplete) {
      // RFC 6455 Section 5.1: Client frames must be masked randomly
      const mask = crypto.randomBytes(4);

      // Byte 0: FIN = 1 (0x80) | Opcode = 0x08 => 0x88
      // Byte 1: Mask bit = 1 (0x80) | Payload length (0) => 0x80
      const header = Buffer.from([0x88, 0x80]);

      const frame = Buffer.concat([header, mask]);

      this.socket.write(frame);
    }
    this.cleanup(shouldEmitClose);
  }

  private performHandshake(url: URL): void {
    const key = crypto.randomBytes(16).toString('base64');
    const path = url.pathname + url.search;

    // Calculate the expected response key
    const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    this.expectedAcceptKey = crypto.createHash('sha1').update(key + magicString).digest('base64');

    let request = `GET ${path} HTTP/1.1\r\n` +
      `Host: ${url.host}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n`;

    // Inject Sec-WebSocket-Protocol if requested
    if (this.options.protocols) {
      const protocolsStr = Array.isArray(this.options.protocols)
        ? this.options.protocols.join(', ')
        : this.options.protocols;
      request += `Sec-WebSocket-Protocol: ${protocolsStr}\r\n`;
    }

    if (this.options.headers) {
      for (const [headerName, headerValue] of Object.entries(this.options.headers)) {
        request += `${headerName}: ${headerValue}\r\n`;
      }
    }

    request += '\r\n';
    this.socket!.write(request);
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    if (!this.isHandshakeComplete) {
      const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) return; // Headers not fully received

      const headersStr = this.buffer.subarray(0, headerEndIndex).toString('utf8');
      const lines = headersStr.split('\r\n');
      const statusLine = lines[0];
      const statusMatch = /^HTTP\/\d+(?:\.\d+)?\s+(\d{3})(?:\s|$)/i.exec(statusLine);
      const statusCode = statusMatch ? Number(statusMatch[1]) : NaN;

      if (statusCode !== 101) {
        this.emit('error', new Error(`Handshake failed. Server responded with: ${statusLine}`));
        this.socket?.destroy();
        return;
      }

      // Verify Sec-WebSocket-Accept
      const acceptHeader = lines.find(l => l.toLowerCase().startsWith('sec-websocket-accept:'));
      const acceptValue = acceptHeader?.split(':')[1].trim();

      if (acceptValue !== this.expectedAcceptKey) {
        this.emit('error', new Error('Handshake failed. Invalid Sec-WebSocket-Accept key.'));
        this.socket?.destroy();
        return;
      }

      // Verify and extract Sec-WebSocket-Protocol
      const protocolHeader = lines.find(l => l.toLowerCase().startsWith('sec-websocket-protocol:'));
      if (protocolHeader) {
        const serverProtocol = protocolHeader.split(':')[1].trim();
        const requestedProtocols = Array.isArray(this.options.protocols)
          ? this.options.protocols
          : (this.options.protocols ? [this.options.protocols] : []);

        // RFC 6455 requires the server to only return a protocol we explicitly asked for
        if (requestedProtocols.length > 0 && !requestedProtocols.includes(serverProtocol)) {
          this.emit('error', new Error(`Handshake failed. Server returned unrequested subprotocol: ${serverProtocol}`));
          this.socket?.destroy();
          return;
        }

        this.protocol = serverProtocol;
      }

      this.isHandshakeComplete = true;
      this.buffer = this.buffer.subarray(headerEndIndex + 4);
      this.emit('open');
    }

    if (this.isHandshakeComplete && this.buffer.length > 0) {
      this.processFrames();
    }
  }

  private processFrames(): void {
    while (this.buffer.length >= 2) {
      const opcode = this.buffer[0] & 0x0F;
      const isMasked = (this.buffer[1] & 0x80) !== 0;
      let payloadLen = this.buffer[1] & 0x7F;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < 4) return; // Wait for more data
        payloadLen = this.buffer.readUInt16BE(2);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < 10) return; // Wait for more data
        const bigLen = this.buffer.readBigUInt64BE(2);

        // Explicit bound check
        if (bigLen > BigInt(MAX_FRAME_SIZE)) {
          this.emit('error', new Error('Frame size exceeds maximum allowed limit'));
          this.socket?.destroy();
          return;
        }

        payloadLen = Number(bigLen);
        offset += 8;
      }

      let maskKey: Buffer | null = null;
      if (isMasked) {
        if (this.buffer.length < offset + 4) return; // Wait for more data
        maskKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (this.buffer.length < offset + payloadLen) return; // Wait for full payload

      const payload = this.buffer.subarray(offset, offset + payloadLen);

      // Servers MUST NOT mask payloads sent to clients, but we unmask if they incorrectly do.
      if (maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      // Route standard opcodes
      if (opcode === 0x01) { // Text
        this.emit('message', payload.toString('utf8'));
      } else if (opcode === 0x02) { // Binary
        this.emit('message', payload);
      } else if (opcode === 0x08) { // Close
        this.close()
      } else if (opcode === 0x09) { // Ping
        this.sendPong(payload);
      }

      // Remove processed frame from buffer
      this.buffer = this.buffer.subarray(offset + payloadLen);
    }
  }

  private sendPong(pingData: Buffer): void {
    if (!this.socket) return;

    // RFC 6455 Section 5.5: Control frames MUST have a payload length of 125 bytes or less
    if (pingData.length > 125) {
      this.emit('error', new Error('Ping payload too large. Closing connection.'));
      this.socket?.destroy();
      return;
    }

    // RFC 6455 Section 5.1: Client frames must be masked randomly
    const maskKey = crypto.randomBytes(4);

    const frame = Buffer.alloc(2 + 4 + pingData.length);
    frame[0] = 0x8A; // FIN = 1 (0x80) | Opcode = 0x0A => 0x8A
    frame[1] = 0x80 | pingData.length; // Mask bit = 1 (0x80) | Payload length

    maskKey.copy(frame, 2);

    // Apply masking to the payload
    for (let i = 0; i < pingData.length; i++) {
      frame[6 + i] = pingData[i] ^ maskKey[i % 4];
    }

    this.socket.write(frame);
  }
}
