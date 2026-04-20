import { WebSocketServer } from 'ws';
import { WebSocketClient } from './ws';
import { AddressInfo } from 'net';
import * as https from 'https';
import * as selfsigned from 'selfsigned';

describe('WebSocketClient', () => {
  let testKey: string;
  let testCert: string;
  let server: WebSocketServer;
  let port: number;
  let httpsServer: https.Server;
  let secureServer: WebSocketServer;
  let securePort: number;

  beforeAll(async () => {
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, { keySize: 2048 });
    testKey = pems.private;
    testCert = pems.cert;

    await new Promise<void>((resolve) => {
      server = new WebSocketServer({ port: 0 }, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      httpsServer = https.createServer({ key: testKey, cert: testCert });
      secureServer = new WebSocketServer({ server: httpsServer });
      httpsServer.listen(0, () => {
        securePort = (httpsServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => secureServer.close(() => resolve()));
    await new Promise<void>((resolve) => httpsServer.close(() => resolve()));
  });

  it('should connect', (done) => {
    const client = new WebSocketClient(`ws://localhost:${port}`);
    client.on('open', () => {
      client.close();
    });
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should receive a text message', (done) => {
    const testMessage = 'Hello from server';

    server.once('connection', (ws) => {
      ws.send(testMessage);
    });

    const client = new WebSocketClient(`ws://localhost:${port}`);
    client.on('message', (message) => {
      expect(message).toBe(testMessage);
      client.close();
    });
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should send a text message', (done) => {
    const testMessage = 'Hello from client';

    server.once('connection', (ws) => {
      ws.on('message', (data, isBinary) => {
        expect(isBinary).toBe(false);
        expect(data.toString()).toBe(testMessage);
        ws.close();
      });
    });

    const client = new WebSocketClient(`ws://localhost:${port}`);
    client.on('open', () => {
      client.send(testMessage);
    });
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should receive a binary message', (done) => {
    const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);

    server.once('connection', (ws) => {
      ws.send(testBuffer);
    });

    const client = new WebSocketClient(`ws://localhost:${port}`);
    client.on('message', (message) => {
      expect(message).toEqual(testBuffer);
      client.close();
    });
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should send a binary message', (done) => {
    const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);

    server.once('connection', (ws) => {
      ws.on('message', (data, isBinary) => {
        expect(isBinary).toBe(true);
        expect(data).toEqual(testBuffer);
        ws.close();
      });
    });

    const client = new WebSocketClient(`ws://localhost:${port}`);
    client.on('open', () => {
      client.send(testBuffer);
    });
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should negotiate subprotocols', (done) => {
    const protocol = 'test-protocol';
    server.once('connection', (ws, req) => {
      expect(req.headers['sec-websocket-protocol']).toBe(protocol);
      ws.close();
    });

    const client = new WebSocketClient(`ws://localhost:${port}`, {
      protocols: [protocol]
    });
    client.on('open', () => {
      expect(client.protocol).toBe(protocol);
    });
    client.on('close', () => {
      done();
    });
    client.connect();
  });

  it('should emit error on connection failure', (done) => {
    const client = new WebSocketClient(`ws://localhost:1`);
    client.on('error', (err) => {
      expect(err).toBeDefined();
      done();
    });
    client.connect();
  });

  it('should send custom headers', (done) => {
    const customHeaderName = 'X-Custom-Header';
    const customHeaderValue = 'test-value';

    server.once('connection', (ws, req) => {
      expect(req.headers[customHeaderName.toLowerCase()]).toBe(customHeaderValue);
      ws.close();
    });

    const client = new WebSocketClient(`ws://localhost:${port}`, {
      headers: {
        [customHeaderName]: customHeaderValue
      }
    });
    client.on('close', () => {
      done();
    });
    client.connect();
  });

  it('should respond to ping with pong', (done) => {
    const pingData = Buffer.from('ping-payload');

    server.once('connection', (ws) => {
      ws.on('pong', (data) => {
        expect(data).toEqual(pingData);
        ws.close();
      });
      ws.ping(pingData);
    });

    const client = new WebSocketClient(`ws://localhost:${port}`);
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should connect via TLS (wss) when allowInsecure is true', (done) => {
    const client = new WebSocketClient(`wss://localhost:${securePort}`, {
      allowInsecure: true
    });
    client.on('open', () => {
      client.close();
    });
    client.on('close', () => {
      done();
    });

    client.connect();
  });

  it('should fail TLS connection with self-signed cert if allowInsecure is false', (done) => {
    const client = new WebSocketClient(`wss://localhost:${securePort}`, {
      allowInsecure: false
    });
    client.on('error', (err) => {
      expect(err).toBeDefined();
      done();
    });

    client.connect();
  });

  it('should fail TLS connection with self-signed cert by default', (done) => {
    const client = new WebSocketClient(`wss://localhost:${securePort}`);
    client.on('error', (err) => {
      expect(err).toBeDefined();
      done();
    });

    client.connect();
  });
});
