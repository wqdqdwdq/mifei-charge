// 米菲记账 - 前端静态服务（零依赖）
// 监听 127.0.0.1:8081，仅服务 public/ 目录，含 SPA fallback
const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = parseInt(process.env.FRONTEND_PORT || '8081', 10);
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    // 带 hash 的资源可长缓存；html 不缓存
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 防止目录穿越
  const safePath = path.normalize(path.join(ROOT, urlPath));
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(res, safePath);
      return;
    }
    // SPA fallback：无扩展名的请求返回 index.html
    if (!path.extname(urlPath)) {
      sendFile(res, path.join(ROOT, 'index.html'));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🌐 米菲前端静态服务已启动：${HOST}:${PORT}`);
});
