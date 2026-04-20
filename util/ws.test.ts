import { WebSocketServer } from 'ws';
import { WebSocketClient } from './ws';
import { AddressInfo } from 'net';
import * as https from 'https';

const testKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4vvgiiySdQqjY
cymmzq4fY5Otc/Iep7CEagdI3CQMwRNyQf4eUQyXNUrcAS7kCUCpECxGRIbErwjO
z1Ayf+rINhBewBMHOzF982ZNKjRMj+jHVQg/ddjGBWeDDDEt1V2CG2qzyADeBF1x
c9llamSJoI9fmNmYdGySb50vOR1lpDP/zptD3EgLEzgo4HT2aqlkNqwdyacIjKfJ
3fHKeQFEE5Yv1bAWTRWxqzSd+zZ9pg+4mLI5+8x+beDgMjuulJy2QEylrRq8B8X0
SFdwUtEVUdbSQQ2RrxJ4gpyNgSyLlFSVulaJ0KhKrzqPZDq5zQRqTghi6oBLs4ee
S31BvA6dAgMBAAECggEANUhSvXe/BCIlG2Q/h44FdyUbgwO1OXUouk/wMOnY9dq7
tpDk7y52AKhMol4u/XLTtM7mzg9WhSRsWGU/Xok5GCxLlWA1PLksQYSxJSE+ezRo
MRFLsy3UauxFGe0qw+rNMMiigh51bZL5tk5wzUidnXnyz+IAI/G0HJnXTjbdTSJL
Pd0DpiZrW2nvCBrU8D4XxKN5m3zwm70H75bfdDaj+53IxkgUNyZRfVR5HqbtOKdz
E+uob7QPyHNjj0PQMfQbauFMVHxKOxry06JJ7oPKCaRxvjsjv7/35ASATmpyCFJs
aJ1WZHQRaW6CoasqvblWVwnN5lK5lh+dOifheTwKawKBgQD9JivGQb44vwvGtXl8
Gz1lanUhmTPbG+y1OSxRN3XlrrUn1Z+9NN/Cm1oGiOt/bHn1c0nsC6uCudUyXwrP
H6gdMHtxkxE5g/4Iwr2sPcfQNSuSHgpSB2bEdf0iDFj9mSrDC+HefUlLUdmuTF8x
+iwCGhFX1hQMJ7sE+r4CF2XlbwKBgQC605eOfV9sKbmnjuJ4t2E/MsCRwfOwN8Vv
RprDue3jeXHLJcOTzJ+Hp+MvFTP11c6bH1PSOStJUiJ08pe3kUvzVG6xgmfHvMr7
+18Mus4el4HMsiSm2LnLPmMLqZGMgSppAgDzmWY+TwIeuRyU2tniwgD9Lgda6sPv
VqtUgnB+swKBgGRuEE/HJUA+Ct36gQfLhsAFTBLYRMpYecArvnk6F3vXo+b5yTW3
FE6Qc1bEWyliT8AgzOLoflKOhxZEvnUNihSKd27Heb3nr5CqMbVzjSH89hwx7sY8
SXkHljU70NJLQbu/qwwpiDppboLHqbyaE3uB+/9s3uczm+6Ny3Po9HPhAoGAVZNE
EYWF5uJ54rFFNSwyRCN4J4uilq4FJoI9s7d/qrlfEUFcA2AwFpAlNNTOdyWXPGCu
IVYEaNJRbCYOrovEMVIUXgSwisIEbEVo9Ui/zy1wzBUxSqds+xa5gYcLX0Nu7Kh5
TRuPxKyl+PKrj9drBD3++/lQbymn1AJr+grBgpcCgYA9DWW74CF2SFkrOlBiV7WO
P+j9nUSoh4hryhUXn4lFxPU+OJrH5yzfWzdcbL5fauEsQcPRC5XfuxZo9lkwvmyX
RwC55mgIZ2b9MliVDwqKAZ4zvg68vkvelbDZnpryLN67PvRi+afulxEo7C3qF9Lq
jInf0Dss51gqNq4P3VS+CQ==
-----END PRIVATE KEY-----`;

const testCert = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUebbr9r9x2qULLlj2/ZM9JM5Rc50wDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDQyMDE1NTI1NFoXDTI2MDQy
MTE1NTI1NFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAuL74IosknUKo2HMpps6uH2OTrXPyHqewhGoHSNwkDMET
ckH+HlEMlzVK3AEu5AlAqRAsRkSGxK8Izs9QMn/qyDYQXsATBzsxffNmTSo0TI/o
x1UIP3XYxgVngwwxLdVdghtqs8gA3gRdcXPZZWpkiaCPX5jZmHRskm+dLzkdZaQz
/86bQ9xICxM4KOB09mqpZDasHcmnCIynyd3xynkBRBOWL9WwFk0Vsas0nfs2faYP
uJiyOfvMfm3g4DI7rpSctkBMpa0avAfF9EhXcFLRFVHW0kENka8SeIKcjYEsi5RU
lbpWidCoSq86j2Q6uc0Eak4IYuqAS7OHnkt9QbwOnQIDAQABo1MwUTAdBgNVHQ4E
FgQUeo9D4wu/qoOdXUqqMN8BwEDnXjowHwYDVR0jBBgwFoAUeo9D4wu/qoOdXUqq
MN8BwEDnXjowDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEABJXp
ICTZYUg4cQO9jbVJcmRCWolypBv83j84WXd1yzi28VWv9Avm6sL9anTBtMKNeTpY
eFw/w74LEccYePHCHqe/U7h2ILV8DCB6eeshWJQQHRCn6MWV209bBwY5RJ8eN2HK
A6mYTDZwJ9XwN5td0It99ZtnsHXwrWECwfOlh0G9+qGs+LvZHCyrTuxaoRvIUkjC
0m3LBIVc0cjcGL9CdQ50H87fYZhN1VuvJI6BCXnLoTHvvqoJhH63+q3W2HMFf4Tc
7FpoVc+bK0817d3h1Svr2FNNIFyiNDSNvdnUb2HZ38bQSoeBUvi8rCCvCgej1GG0
dklOFYBZmnY49vEMUw==
-----END CERTIFICATE-----`;

describe('WebSocketClient', () => {
  let server: WebSocketServer;
  let port: number;
  let httpsServer: https.Server;
  let secureServer: WebSocketServer;
  let securePort: number;

  beforeAll(async () => {
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
