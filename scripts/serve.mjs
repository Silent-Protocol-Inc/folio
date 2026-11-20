import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { openDatabase } from './database.mjs';
import { bind } from './sqlite.mjs';
import worker from '../dist/server/index.js';

process.umask(0o077);
const site = new URL(process.env.FOLIO_ORIGIN || '');
const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(site.hostname);
if (site.origin !== process.env.FOLIO_ORIGIN || !(site.protocol === 'https:' || (loopback && site.protocol === 'http:')) || site.username || site.password) {
 throw Error('FOLIO_ORIGIN must be the exact HTTPS origin, with no trailing slash. HTTP is available for local loopback testing.');
}
const port = Number(process.env.PORT || '4173');
// Loopback by default. The Docker image sets 0.0.0.0 inside the container and publishes the port on the host's 127.0.0.1 only.
const host = process.env.FOLIO_HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be between 1 and 65535.');
const db = openDatabase();
const env = { DB: bind(db), FOLIO_ORIGIN: site.origin };
const server = createServer(async (req, res) => {
 try {
  if (!req.url?.startsWith('/') || req.url.startsWith('//')) {
   res.writeHead(400).end();
   return;
  }
  const method = req.method || 'GET';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
   if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const fromProxy = headers.get('x-folio-client-ip');
  headers.set('cf-connecting-ip', fromProxy && isIP(fromProxy) ? fromProxy : req.socket.remoteAddress || 'loopback');
  headers.delete('x-folio-client-ip');
  const browserRequest = new Request(site.origin + req.url, {
   method, headers, ...(['GET','HEAD'].includes(method) ? {} : {body: Readable.toWeb(req), duplex:'half'})
  });
  const response = await worker.fetch(browserRequest, env);
  const responseHeaders = Object.fromEntries(response.headers);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) responseHeaders['set-cookie'] = cookies;
  const body = Buffer.from(await response.arrayBuffer());
  // A known length (not chunked): iOS's home-screen icon fetch is picky.
  if (method !== 'HEAD') responseHeaders['content-length'] = String(body.length);
  res.writeHead(response.status, responseHeaders);
  res.end(body);
 } catch (error) {
  console.error('Folio HTTP request failed:', error.name);
  if (!res.headersSent) res.writeHead(500);
  res.end();
 }
});
server.listen(port, host, () => console.log('Folio listening on ' + host + ':' + port));
for (const signal of ['SIGINT','SIGTERM']) {
 process.once(signal, () => {
  server.close(() => db.close());
 });
}
