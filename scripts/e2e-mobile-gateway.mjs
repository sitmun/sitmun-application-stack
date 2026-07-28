#!/usr/bin/env node
import { createServer, request as httpRequest } from 'node:http';

const HOST = '127.0.0.1';
const PORT = 18081;

const ROUTES = [
  { prefix: '/backend', target: 'http://127.0.0.1:18080' },
  { prefix: '/middleware', target: 'http://127.0.0.1:18082' },
];

function fail(message) {
  console.error(`[e2e-mobile-gateway] ${message}`);
  process.exit(1);
}

function proxy(req, res, targetBase, stripPrefix) {
  const incoming = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const upstreamPath = incoming.pathname.startsWith(stripPrefix)
    ? incoming.pathname.slice(stripPrefix.length) || '/'
    : incoming.pathname;
  const target = new URL(upstreamPath + incoming.search, targetBase);

  const headers = { ...req.headers, host: target.host };
  delete headers['content-length'];

  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    console.error(`[e2e-mobile-gateway] upstream error: ${error.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('bad gateway');
  });

  req.pipe(upstream);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (url.pathname === '/mbtiles' || url.pathname.startsWith('/mbtiles/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('mbtiles is not publicly routed');
    return;
  }

  const route = ROUTES.find((r) => url.pathname === r.prefix || url.pathname.startsWith(`${r.prefix}/`));
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }

  proxy(req, res, route.target, route.prefix);
});

server.on('error', (error) => fail(`Failed to bind ${HOST}:${PORT}: ${error.message}`));

server.listen(PORT, HOST, () => {
  console.error(`[e2e-mobile-gateway] listening on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
