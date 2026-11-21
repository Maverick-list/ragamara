import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = '/home/firza-ilmi/.gemini/antigravity/scratch/ragamara';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://*.supabase.co https://api.twilio.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const server = http.createServer(async (req, res) => {
  // Apply standard production-grade HTTP security headers
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(k, v);
  }

  // CORS & caching headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-nular-client');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawUrl = (req.url || '/').split('?')[0];

  // Route /api/* requests to Vercel serverless function handlers
  if (rawUrl.startsWith('/api/')) {
    const modName = rawUrl.slice(5).split('?')[0];
    const modPath = path.join(ROOT_DIR, 'api', `${modName}.js`);
    if (fs.existsSync(modPath)) {
      try {
        const mod = await import(`file://${modPath}`);
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const init = { method: req.method, headers: req.headers };
        if (req.method !== 'GET' && req.method !== 'HEAD' && chunks.length) {
          init.body = Buffer.concat(chunks);
        }
        const webReq = new Request(`http://127.0.0.1:${PORT}${req.url}`, init);
        const fn = mod[req.method] || mod.GET;
        if (typeof fn === 'function') {
          const webRes = await fn(webReq);
          const headersObj = {};
          webRes.headers.forEach((v, k) => { headersObj[k] = v; });
          res.writeHead(webRes.status, headersObj);
          res.end(await webRes.text());
          return;
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
  }

  let relPath = rawUrl === '/' ? 'index.html' : rawUrl.replace(/^\/+/, '');
  let fullPath = path.join(ROOT_DIR, relPath);

  // Clean URL rewrite (e.g. /explore -> /explore.html)
  if (!fs.existsSync(fullPath) && !path.extname(relPath) && fs.existsSync(`${fullPath}.html`)) {
    fullPath = `${fullPath}.html`;
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p>Halaman atau berkas tidak ditemukan.</p><p><a href="/">Kembali ke Beranda</a></p>');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`🏛️  NULAR — Museum Arsitektur Nusantara Berjalan Lokal`);
  console.log(`====================================================`);
  console.log(`🌐 Server aktif di: http://localhost:${PORT}`);
  console.log(`   - Beranda:         http://localhost:${PORT}/index.html`);
  console.log(`   - Katalog Rumah:   http://localhost:${PORT}/explore.html`);
  console.log(`   - 3D Rumah Gadang: http://localhost:${PORT}/house.html?id=rumah-gadang`);
  console.log(`   - 3D Tongkonan:    http://localhost:${PORT}/house.html?id=tongkonan-toraja`);
  console.log(`   - 3D Rumah Joglo:  http://localhost:${PORT}/house.html?id=rumah-joglo`);
  console.log(`   - 3D Honai Papua:  http://localhost:${PORT}/house.html?id=honai-papua`);
  console.log(`   - Peta Interaktif: http://localhost:${PORT}/map.html`);
  console.log(`   - Komparator:      http://localhost:${PORT}/anatomy.html`);
  console.log(`   - Jurnal:          http://localhost:${PORT}/profile.html`);
  console.log(`   - Tentang:         http://localhost:${PORT}/about.html`);
  console.log(`====================================================`);
});
