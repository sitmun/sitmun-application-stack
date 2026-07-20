#!/usr/bin/env node
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 18093;
const USER = 'e2e-wms';
const PASSWORD = 'e2e-wms-secret';
const EXPECTED_AUTH = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;

// OnlineResource must be the stub base URL so proxy middleware can rewrite it to
// the public proxy path (empty OnlineResource made OL GetMap hit the viewer origin).
const STUB_WMS_URL = `http://${HOST}:${PORT}/wms`;

/** Seed WMS names used by catalog E2E leaves (GEO 4/5/6/7 + situation map). */
const LAYER_NAMES = [
  'DTE50_MUN',
  'DTE50_PROV',
  '02_ALTI_PA',
  '03_ALTI_LN',
  '03_POBL_PA',
  '04_ALTI_LN',
  '04_POBL_PA',
  '05_VEGE_PA',
  '06_VEGE_PA',
  '07_POBL_PA',
  '08_VEGE_PA',
  '09_VEGE_LN',
  '10_VEGE_LN',
  '11_HIDR_PA',
  '12_HIDR_PA',
  '13_ALTI_LN',
  '14_ALTI_LN',
  '15_ALTI_LN',
  '16_ALTI_LN',
  '18_POBL_PA',
  '19_HIDR_PA',
  '20_HIDR_LN',
  '21_HIDR_LN',
  '22_HIDR_LN',
  '23_HIDR_LN',
  '24_POBL_LN',
  '25_POBL_LN',
  '26_ALTI_LN',
  '27_ALTI_LN',
  '28_POBL_LN',
  '29_ALTI_PNTX',
  '29_POBL_LN',
  '30_ALTI_TX',
  '30_POBL_PN',
  '31_VIES_LN',
  '32_VIES_LN',
  '33_VIES_LN',
  '34_TOPO_TX',
  '34_VIES_LN',
  '35_VIES_LN',
  '36_VIES_LN',
  '37_VIES_LN',
  '38_POBL_LN',
  '39_HIDR_LN',
  '40_VIES_LN',
  '41_VIES_LN',
  '42_VIES_LN',
  '43_POBL_LN',
  '44_POBL_LN',
  '45_TOPO_TX',
  '46_PREF_PNTX',
  '48_ALTI_TX',
];

function layerXml(name) {
  // Capas #92 E2E: Toponímia out-of-scale when OGC scale > 100000 (zoom out).
  const scale =
    name === '34_TOPO_TX'
      ? '\n        <MaxScaleDenominator>100000</MaxScaleDenominator>'
      : '';
  return `      <Layer queryable="1">
        <Name>${name}</Name>
        <Title>${name}</Title>${scale}
      </Layer>`;
}

const CAPABILITIES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns:xlink="http://www.w3.org/1999/xlink">
  <Service>
    <Name>WMS</Name>
    <Title>E2E Secured WMS Stub</Title>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities>
        <DCPType>
          <HTTP>
            <Get>
              <OnlineResource xlink:type="simple" xlink:href="${STUB_WMS_URL}?"/>
            </Get>
          </HTTP>
        </DCPType>
      </GetCapabilities>
      <GetMap>
        <DCPType>
          <HTTP>
            <Get>
              <OnlineResource xlink:type="simple" xlink:href="${STUB_WMS_URL}?"/>
            </Get>
          </HTTP>
        </DCPType>
      </GetMap>
    </Request>
    <Layer>
      <Title>Root</Title>
      <CRS>EPSG:25831</CRS>
      <CRS>EPSG:4326</CRS>
      <CRS>EPSG:3857</CRS>
      <EX_GeographicBoundingBox>
        <westBoundLongitude>-1.5</westBoundLongitude>
        <eastBoundLongitude>3.5</eastBoundLongitude>
        <southBoundLatitude>40.0</southBoundLatitude>
        <northBoundLatitude>43.5</northBoundLatitude>
      </EX_GeographicBoundingBox>
${LAYER_NAMES.map(layerXml).join('\n')}
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

    const requestName = (url.searchParams.get('REQUEST') || url.searchParams.get('request') || '')
      .toLowerCase();
    if (requestName === 'getmap') {
      // 1x1 PNG so Capas rows are not cleared by TILELOADERROR after add.
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'X-E2E-Upstream': 'secured-wms',
      });
      res.end(png);
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
  fail(`listen failed: ${error.message}`);
});

server.listen(PORT, HOST, () => {
  console.error(`[e2e-wms-stub] Listening on http://${HOST}:${PORT}`);
});

const shutdown = () => {
  console.error('[e2e-wms-stub] Shutting down (SIGTERM)...');
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
