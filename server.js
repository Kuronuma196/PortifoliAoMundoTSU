const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ contacts: [], newsSuggestions: [], roleRequests: [], analyticsEvents: [] }, null, 2)
  );
}

function readDb() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  const safe = path.normalize(pathname === '/' ? '/index.html' : pathname).replace(/^\.+/, '');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, phase: 1, message: 'Backend e banco local ativos' });
  }

  if (pathname === '/api/contact' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.name || !payload.email || !payload.message) {
      return sendJson(res, 400, { error: 'Dados inválidos' });
    }
    const db = readDb();
    db.contacts.push({ ...payload, at: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/news-suggestions' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.title || !payload.summary) return sendJson(res, 400, { error: 'Dados inválidos' });
    const db = readDb();
    db.newsSuggestions.push({ ...payload, at: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/role-requests' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.role || !payload.title || !payload.description) {
      return sendJson(res, 400, { error: 'Dados inválidos' });
    }
    const db = readDb();
    db.roleRequests.push({ ...payload, at: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/analytics/events' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.type) return sendJson(res, 400, { error: 'Dados inválidos' });
    const db = readDb();
    db.analyticsEvents.push({ ...payload, at: payload.at || new Date().toISOString() });
    db.analyticsEvents = db.analyticsEvents.slice(-2000);
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/dashboard' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, {
      counts: {
        contacts: db.contacts.length,
        newsSuggestions: db.newsSuggestions.length,
        roleRequests: db.roleRequests.length,
        analyticsEvents: db.analyticsEvents.length,
      },
      latestRoleRequests: db.roleRequests.slice(-8).reverse(),
      latestNews: db.newsSuggestions.slice(-8).reverse(),
    });
  }

  if (pathname === '/api/news-suggestions' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, db.newsSuggestions.slice(-30));
  }

  if (pathname === '/api/analytics/events' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, db.analyticsEvents);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`TSU server running on http://0.0.0.0:${PORT}`);
});
