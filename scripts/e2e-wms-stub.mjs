#!/usr/bin/env node
/**
 * Local secured WMS stub for root Playwright viewer E2E.
 *
 * DiBa/ArcGIS-style behavior for sitmun-viewer-app#164 (CAE1M / PCE5M oracle):
 * - DescribeLayer → RequestNotAllowed
 * - GetCapabilities Style/LegendURL → /legend (distinct from /wms MapServer path)
 * - GetLegendGraphic on /wms fails (native SITNA getLegend path cannot paint)
 * - GET /legend returns a stable PNG (>100 bytes) for Capas + LegendURL fallback
 * - GetFeatureInfo for 34_TOPO_TX / tu007rts_ccavalls → JSON FeatureCollection (or XML fixture)
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GFI_XML_PATH = join(__dirname, '../e2e/mia-cross/fixtures/gfi-34_TOPO_TX.xml');
/** GML2 FeatureCollection — id prefix 34_TOPO_TX. maps to the queryable layer. */
const GFI_GML = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <gml:featureMember>
    <34_TOPO_TX fid="34_TOPO_TX.1">
      <gml:name>e2e-gfi-click</gml:name>
      <id>1</id>
      <name>e2e-gfi-click</name>
    </34_TOPO_TX>
  </gml:featureMember>
</wfs:FeatureCollection>
`;

let GFI_XML = GFI_GML;
try {
  GFI_XML = readFileSync(GFI_XML_PATH, 'utf8');
} catch {
  GFI_XML = GFI_GML;
}

// Coordinates in EPSG:25831 (viewer map CRS) so ol.format.GeoJSON readFeatures does not throw.
const GFI_JSON = JSON.stringify({
  type: 'FeatureCollection',
  crs: { type: 'name', properties: { name: 'EPSG:25831' } },
  features: [
    {
      type: 'Feature',
      id: '34_TOPO_TX.1',
      geometry: {
        type: 'Point',
        coordinates: [422500, 4608500],
      },
      properties: {
        id: 1,
        name: 'e2e-gfi-click',
      },
    },
  ],
});


const HOST = '127.0.0.1';
const PORT = 18093;
const USER = 'e2e-wms';
const PASSWORD = 'e2e-wms-secret';
const EXPECTED_AUTH = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;

// OnlineResource must be the stub base URL so proxy middleware can rewrite it to
// the public proxy path (empty OnlineResource made OL GetMap hit the viewer origin).
const STUB_WMS_URL = `http://${HOST}:${PORT}/wms`;
const STUB_LEGEND_URL = `http://${HOST}:${PORT}/legend`;

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
  'tu007rts_ccavalls',
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

/** 32×32 PNG (>100 bytes) so SITNA getLegend blob size gate accepts Capas/fallback imgs. */
const LEGEND_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAJCElEQVR4AQXBeRzWAgPA8b2n532f93U9zFXLdLBaqMY6sBo6xiq0Gh1ohQ7TgVroYB2ohg6sQsfoQCs/HaYDtdDBOlDNfTx47+c9/3k+n/f7FQSBUwROFThboIVAa4H2Ap0EugoYAr0FbIFBAkMFRgqMEZggMEVgusBsgfkCiwRigZUCawU2CmwR2CGwR2C/wGGB4wLCL6pUqpxWRazSskqbKh2qdK7SrUrPKn2q9K/iVBlWxasytsrEKlOrzKgyp8qCKourLKuyqsq6KmmVrVV2Vtlb5UCVI1VOVBF+KfI7kdNFzhGRRNqKqCJdRLqL9BLpKzJAZLDIcJFRIuNEJokEIjNF5oosFFkislxktch6kU0i20R2ieQiB0WOipwUEX4l83uZM2TOlWkl006mo4wm00PGlOknM1BmiMwImdEy42Umy0yTmSUzTyaSWSqzQmaNzAaZzTLbZXbL7JM5JHNMppQRfq1SVTlT5TyVC1UuVrlU5QqVq1SuVbFUblJxVW5XuUvlXpX7VR5SeVTlcZWnVJ5VeUElUXlV5Q2Vt1TeUXlf5SOVT1Q+VxF+o/MHnZrO+TqyziU6l+lcqXO1znU6N+jcrHOrzh06d+v4Og/oPKzzmM4TOk/rPKfzos7LOq/poJPpvKvzgc7HOp/qfKEj/NbkjyZnmVxgcpGJYnK5iW5yjcn1Jjea3GJym8mdJveY3GfyoMkjJqHJkybPmDxv8pLJKyavm7xp8rbJeyYfmhQmn5l8aSKcYnOqzdk2LWxa27S36WTT1caw6W1j2wyyGWoz0maMzQSbKTbTbWbbzLdZZBPbrLRZa7PRZovNDps9NvttDtsct/nKRqi4nOYiurR0aePSwaWzSzeXni59XPq7OC7DXDyXsS4TXaa6zHCZ47LAZbHLMpdVLutcUpetLjtd9roccDnicsLlaxfhdx6ne5zjIXm09VA9unh09+jl0ddjgMdgj+EeozzGeUzyCDxmesz1WOixxGO5x2qP9R6bPLZ57PLIPQ56HPU46fGNh/B7nzN8zvVp5dPOp6OP5tPDx/Tp5zPQZ4jPCJ/RPuN9JvtM85nlM88n8lnqs8Jnjc8Gn80+2312++zzOeRzzKf0+dZHqAacGXBewIUBFwdcGnBFwFUB1wZYATcFuAG3B9wVcG/A/QEPBTwa8HjAUwHPBrwQkAS8GvBGwFsB7wS8H/BRwCcBnwd8FyD8IaQWcn6IHHJJyGUhV4ZcHXJdyA0hN4fcGnJHyN0hfsgDIQ+HPBbyRMjTIc+FvBjycshrIYRkIe+GfBDyccinIV+EfB8i/DHirIgLIi6KUCIuj9Ajrom4PuLGiFsibou4M+KeiPsiHox4JCKMeDLimYjnI16KeCXi9Yg3I96OeC/iw4gi4rOILyN+iBBOjTk7pkVM65j2MZ1iusYYMb1j7JhBMUNjRsaMiZkQMyVmeszsmPkxi2LimJUxa2M2xmyJ2RGzJ2Z/zOGY4zFfxdRjhNMSxISWCW0SOiR0TuiW0DOhT0L/BCdhWIKXMDZhYsLUhBkJcxIWJCxOWJawKmFdQpqwNWFnwt6EAwlHEk4kfJ3wY4Jweso5KVJK2xQ1pUtK95ReKX1TBqQMThmeMiplXMqklCBlZsrclIUpS1KWp6xOWZ+yKWVbyq6UPOVgytGUkynfpPyUIpyRcW5Gq4x2GR0ztIweGWZGv4yBGUMyRmSMzhifMTljWsasjHkZUcbSjBUZazI2ZGzO2J6xO2NfxqGMYxllxrcZP2cIZ+acl3NhzsU5l+ZckXNVzrU5Vs5NOW7O7Tl35dybc3/OQzmP5jye81TOszkv5CQ5r+a8kfNWzjs57+d8lPNJzuc53+X8KUeoFZxfIBdcUnBZwZUFVxdcV3BDwc0FtxbcUXB3gV/wQMHDBY8VPFHwdMFzBS8WvFzwWgEFWcG7BR8UfFzwacEXBd8X/LlAOKvkgpKLSpSSy0v0kmtKri+5seSWkttK7iy5p+S+kgdLHikJS54seabk+ZKXSl4peb3kzZK3S94r+bCkKPms5MuSH0r+UiKcXadFndZ12tfpVKdrHaNO7zp2nUF1htYZWWdMnQl1ptSZXmd2nfl1FtWJ66yss7bOxjpb6uyos6fO/jqH6xyv81Wdep2/1hHEBi0btGnQoUHnBt0a9GzQp0H/Bk6DYQ28BmMbTGwwtcGMBnMaLGiwuMGyBqsarGuQNtjaYGeDvQ0ONDjS4ESDrxv82OBvDYRzmkhN2jZRm3Rp0r1JryZ9mwxoMrjJ8CajmoxrMqlJ0GRmk7lNFjZZ0mR5k9VN1jfZ1GRbk11N8iYHmxxtcrLJN01+avL3JsK5FVpVaFehYwWtQo8KZoV+FQZWGFJhRIXRFcZXmFxhWoVZFeZViCosrbCiwpoKGypsrrC9wu4K+yocqnCsQlnh2wo/V/hHBeG8GhfWuLjGpTWuqHFVjWtrWDVuquHWuL3GXTXurXF/jYdqPFrj8RpP1Xi2xgs1khqv1nijxls13qnxfo2PanxS4/Ma39X4U41GDeF8CVniEonLJK6UuFriOokbJG6WuFXiDom7JXyJByQelnhM4gmJpyWek3hR4mWJ1ySQyCTelfhA4mOJTyW+kPhe4s8S/5QQLlC4SEFRuFxBV7hG4XqFGxVuUbhN4U6FexTuU3hQ4RGFUOFJhWcUnld4SeEVhdcV3lR4W+E9hQ8VCoXPFL5U+EHhLwr/UhBaaLTWaK/RSaOrhqHRW8PWGKQxVGOkxhiNCRpTNKZrzNaYr7FII9ZYqbFWY6PGFo0dGns09msc1jiu8ZVGXeOvGv/WEFoatDHoYNDZoJtBT4M+Bv0NHINhBp7BWIOJBlMNZhjMMVhgsNhgmcEqg3UGqcFWg50Gew0OGBwxOGHwtcGPBn8z+I+BIFm0tVAtulh0t+hl0ddigMVgi+EWoyzGWUyyCCxmWsy1WGixxGK5xWqL9RabLLZZ7LLILQ5aHLU4afGNxU8Wf7f4r4XQyqGdQ0cHzaGHg+nQz2GgwxCHEQ6jHcY7THaY5jDLYZ5D5LDUYYXDGocNDpsdtjvsdtjncMjhmEPp8K3Dzw7/cPifw/8BhitqW4gFlYMAAAAASUVORK5CYII=',
  'base64',
);

const GETMAP_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function layerXml(name) {
  // Capas #92 E2E: Toponímia out-of-scale when OGC scale > 100000 (zoom out).
  const scale =
    name === '34_TOPO_TX'
      ? '\n        <MaxScaleDenominator>100000</MaxScaleDenominator>'
      : '';
  // #164: LegendURL on a distinct servlet-like path (not /wms GetLegendGraphic).
  return `      <Layer queryable="1">
        <Name>${name}</Name>
        <Title>${name}</Title>${scale}
        <Style>
          <Name>default</Name>
          <Title>default</Title>
          <LegendURL width="8" height="8">
            <Format>image/png</Format>
            <OnlineResource xlink:type="simple" xlink:href="${STUB_LEGEND_URL}?layer=${encodeURIComponent(name)}"/>
          </LegendURL>
        </Style>
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

function serviceException(code, message, version = '1.3.0') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ServiceExceptionReport version="${version}">
  <ServiceException code="${code}">
${message}
  </ServiceException>
</ServiceExceptionReport>
`;
}

function fail(message) {
  console.error(`[e2e-wms-stub] ${message}`);
  process.exit(1);
}

function requestNameOf(url) {
  return (url.searchParams.get('REQUEST') || url.searchParams.get('request') || '').toLowerCase();
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Capas / LegendURL fallback: no Basic auth (browser <img> cannot send it).
  if (method === 'GET' && url.pathname === '/legend') {
    console.error(`[e2e-wms-stub] GET /legend layer=${url.searchParams.get('layer') ?? ''}`);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': '*',
      'X-E2E-Upstream': 'legend-url',
    });
    res.end(LEGEND_PNG);
    return;
  }

  if (method === 'OPTIONS' && url.pathname === '/wms') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    });
    res.end();
    return;
  }

  if (method === 'GET' && url.pathname === '/wms') {
    const authorization = req.headers.authorization;
    // Proxied E2E sends Basic; direct Menorca solrustic leaf has no browser auth.
    const accepted = !authorization || authorization === EXPECTED_AUTH;
    const requestName = requestNameOf(url);
    console.error(
      `[e2e-wms-stub] ${method} ${url.pathname} request=${requestName || 'capabilities'} basicAuth=${authorization ? (authorization === EXPECTED_AUTH ? 'accepted' : 'rejected') : 'none'}`,
    );

    if (!accepted) {
      res.writeHead(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Basic realm="e2e-wms"',
        'Access-Control-Allow-Origin': '*',
      });
      res.end('unauthorized');
      return;
    }

    const cors = { 'Access-Control-Allow-Origin': '*' };

    if (requestName === 'describelayer') {
      res.writeHead(200, {
        'Content-Type': 'text/xml',
        'X-E2E-Upstream': 'secured-wms',
        ...cors,
      });
      res.end(serviceException('RequestNotAllowed', 'The request not allowed.', '1.1.1'));
      return;
    }

    if (requestName === 'getlegendgraphic') {
      const format = (
        url.searchParams.get('FORMAT') ||
        url.searchParams.get('format') ||
        ''
      ).toLowerCase();
      // JSON probe: InvalidFormat XML → SITNA treats as PNG-capable (DiBa).
      // PNG fetch: body must be <100 bytes so Raster.getLegend discards the blob
      // and Capas-parity LegendURL fallback can run (#164).
      if (format.includes('json')) {
        res.writeHead(200, {
          'Content-Type': 'text/xml',
          'X-E2E-Upstream': 'secured-wms',
          ...cors,
        });
        res.end(
          serviceException('InvalidFormat', "Parameter 'format' contains unacceptable value."),
        );
      } else {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'X-E2E-Upstream': 'secured-wms',
          ...cors,
        });
        res.end(Buffer.alloc(50));
      }
      return;
    }

    if (requestName === 'getmap') {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'X-E2E-Upstream': 'secured-wms',
        ...cors,
      });
      res.end(GETMAP_PNG);
      return;
    }

    if (requestName === 'getfeatureinfo') {
      const queryLayers = (
        url.searchParams.get('QUERY_LAYERS') ||
        url.searchParams.get('query_layers') ||
        url.searchParams.get('LAYERS') ||
        url.searchParams.get('layers') ||
        ''
      ).toLowerCase();
      // SITNA requires Content-Type to equal INFO_FORMAT exactly or it treats the body as an error.
      const infoFormat = (
        url.searchParams.get('INFO_FORMAT') ||
        url.searchParams.get('info_format') ||
        'application/json'
      ).trim();
      const infoFormatLower = infoFormat.toLowerCase();
      console.error(
        `[e2e-wms-stub] GetFeatureInfo queryLayers=${queryLayers} infoFormat=${infoFormat}`,
      );
      const isTopo = queryLayers.includes('34_topo_tx');
      const isCcavalls = queryLayers.includes('tu007rts_ccavalls');
      if (!isTopo && !isCcavalls) {
        res.writeHead(200, {
          'Content-Type': infoFormat || 'application/json',
          'X-E2E-Upstream': 'secured-wms',
          ...cors,
        });
        res.end(
          infoFormatLower.includes('json')
            ? JSON.stringify({ type: 'FeatureCollection', features: [] })
            : GFI_XML.replace('e2e-gfi-click', 'empty'),
        );
        return;
      }
      if (infoFormatLower.includes('json')) {
        const body = isCcavalls
          ? JSON.stringify({
              type: 'FeatureCollection',
              crs: { type: 'name', properties: { name: 'EPSG:25831' } },
              features: [
                {
                  type: 'Feature',
                  id: 'tu007rts_ccavalls.1',
                  geometry: {
                    type: 'Point',
                    coordinates: [589000, 4420000],
                  },
                  properties: { id: 1, nomruta: 'e2e-ccavalls' },
                },
              ],
            })
          : GFI_JSON;
        res.writeHead(200, {
          'Content-Type': infoFormat,
          'X-E2E-Upstream': 'secured-wms-gfi',
          ...cors,
        });
        res.end(body);
        return;
      }
      res.writeHead(200, {
        'Content-Type': infoFormat || 'application/vnd.ogc.gml',
        'X-E2E-Upstream': 'secured-wms-gfi',
        ...cors,
      });
      res.end(GFI_XML);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/xml',
      'X-E2E-Upstream': 'secured-wms',
      ...cors,
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
