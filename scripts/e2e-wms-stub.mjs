#!/usr/bin/env node
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 18093;
const USER = 'e2e-wms';
const PASSWORD = 'e2e-wms-secret';
const EXPECTED_AUTH = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;

const CAPABILITIES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0">
  <Service>
    <Name>WMS</Name>
    <Title>E2E Secured WMS Stub</Title>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities/>
      <GetMap/>
    </Request>
    <Layer>
      <Title>Root</Title>
      <Layer queryable="1">
        <Name>DTE50_MUN</Name>
        <Title>Municipality</Title>
      </Layer>
      <Layer queryable="1">
        <Name>DTE50_PROV</Name>
        <Title>Province</Title>
      </Layer>
      <Layer queryable="1">
        <Name>34_TOPO_TX</Name>
        <Title>Toponymy</Title>
      </Layer>
      <Layer queryable="1">
        <Name>03_ALTI_LN</Name>
        <Title>Altimetry 03</Title>
      </Layer>
      <Layer queryable="1">
        <Name>04_ALTI_LN</Name>
        <Title>Altimetry 04</Title>
      </Layer>
      <Layer queryable="1">
        <Name>29_ALTI_PNTX</Name>
        <Title>Altimetry 29</Title>
      </Layer>
      <Layer queryable="1">
        <Name>30_ALTI_TX</Name>
        <Title>Altimetry 30</Title>
      </Layer>
      <Layer queryable="1">
        <Name>02_ALTI_PA</Name>
        <Title>Topo 1:25k sample</Title>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>
`;

function fail(message) {
  console.error(`[e2e-wms-stub] ${message}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (method === 'GET' && url.pathname === '/wms') {
    const authorization = req.headers.authorization;
    const accepted = authorization === EXPECTED_AUTH;
    console.error(
      `[e2e-wms-stub] ${method} ${url.pathname} basicAuth=${accepted ? 'accepted' : 'rejected'}`,
    );

    if (!accepted) {
      res.writeHead(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Basic realm="e2e-wms"',
      });
      res.end('unauthorized');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/xml',
      'X-E2E-Upstream': 'secured-wms',
    });
    res.end(CAPABILITIES_XML);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.on('error', (error) => {
  fail(`Failed to bind ${HOST}:${PORT}: ${error.message}`);
});

server.listen(PORT, HOST, () => {
  console.error(`[e2e-wms-stub] Listening on http://${HOST}:${PORT}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.error(`[e2e-wms-stub] Shutting down (${signal})...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(signal));
}
