#!/usr/bin/env node
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 18094;

const CAPABILITIES = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities version="1.0.0">
  <ServiceIdentification>
    <Title>E2E WMTS Stub</Title>
  </ServiceIdentification>
  <Contents>
    <Layer>
      <ows:Identifier>e2e-layer</ows:Identifier>
      <Title>E2E Layer</Title>
    </Layer>
  </Contents>
</Capabilities>
`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function fail(message) {
  console.error(`[e2e-wmts-stub] ${message}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/wmts') {
    const request = (url.searchParams.get('REQUEST') || url.searchParams.get('request') || '').toLowerCase();
    if (request === 'getcapabilities' || request === '') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(CAPABILITIES);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(PNG);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.on('error', (error) => fail(`Failed to bind ${HOST}:${PORT}: ${error.message}`));
server.listen(PORT, HOST, () => {
  console.error(`[e2e-wmts-stub] listening on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
