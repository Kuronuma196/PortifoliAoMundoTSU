const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const defaultDb = {
  contacts: [],
  newsSuggestions: [],
  roleRequests: [],
  analyticsEvents: [],
  notifications: [],
  cmsArticles: [],
  creationJobs: [],
  auth: {
    employeeWhitelist: ['kuronumadeal@gmail.com'],
  },
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(defaultDb, null, 2));

function readDb() {
  const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(parsed.contacts)) parsed.contacts = [];
  if (!Array.isArray(parsed.newsSuggestions)) parsed.newsSuggestions = [];
  if (!Array.isArray(parsed.roleRequests)) parsed.roleRequests = [];
  if (!Array.isArray(parsed.analyticsEvents)) parsed.analyticsEvents = [];
  if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
  if (!Array.isArray(parsed.cmsArticles)) parsed.cmsArticles = [];
  if (!Array.isArray(parsed.creationJobs)) parsed.creationJobs = [];
  if (!parsed.auth || !Array.isArray(parsed.auth.employeeWhitelist)) {
    parsed.auth = { employeeWhitelist: [...defaultDb.auth.employeeWhitelist] };
  }
  return parsed;
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
    return sendJson(res, 200, { ok: true, phase: 5, message: 'Fase 5 ativa: criação multimídia produção + design unificado' });
  }

  if (pathname === '/api/auth/employee-whitelist' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, { emails: db.auth.employeeWhitelist });
  }

  if (pathname === '/api/notifications' && req.method === 'GET') {
    const audience = (url.searchParams.get('audience') || '').trim().toLowerCase();
    const db = readDb();
    const filtered = audience
      ? db.notifications.filter((n) => n.audience === 'all' || n.audience === audience)
      : db.notifications;
    return sendJson(res, 200, filtered.slice(-50).reverse());
  }

  if (pathname === '/api/notifications' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.title || !payload.message) {
      return sendJson(res, 400, { error: 'Dados inválidos' });
    }
    const db = readDb();
    db.notifications.push({
      title: String(payload.title).trim(),
      message: String(payload.message).trim(),
      audience: String(payload.audience || 'all').toLowerCase(),
      source: String(payload.source || 'portal').trim(),
      at: new Date().toISOString(),
    });
    db.notifications = db.notifications.slice(-500);
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }



  if (pathname === '/api/creation/generate' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.type || !payload.prompt) {
      return sendJson(res, 400, { error: 'Dados inválidos' });
    }

    const type = String(payload.type).trim().toLowerCase();
    const prompt = String(payload.prompt).trim();
    const job = {
      id: `job_${Date.now()}`,
      type,
      prompt,
      at: new Date().toISOString(),
      status: 'completed',
      output: {},
    };

    if (type === 'text') {
      job.output = {
        text: `Versão inicial gerada para: ${prompt}`,
        excerpt: `Resumo criativo: ${prompt.slice(0, 140)}`,
      };
    } else if (type === 'image') {
      job.output = {
        url: 'assets/images/hero-universe.svg',
        caption: `Conceito visual para: ${prompt}`,
      };
    } else if (type === 'video') {
      job.output = {
        url: 'https://example.com/video-demo-tsu',
        storyboard: `Storyboard base para: ${prompt}`,
      };
    } else if (type === 'audio') {
      job.output = {
        url: 'https://example.com/audio-demo-tsu',
        notes: `Guia sonoro para: ${prompt}`,
      };
    } else {
      return sendJson(res, 400, { error: 'Tipo de geração inválido' });
    }

    const db = readDb();
    db.creationJobs.push(job);
    db.creationJobs = db.creationJobs.slice(-500);
    writeDb(db);
    return sendJson(res, 201, { ok: true, jobId: job.id, output: job.output, phase: 5 });
  }

  if (pathname === '/api/cms/articles' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, db.cmsArticles.slice(-80).reverse());
  }

  if (pathname === '/api/cms/articles' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    if (!payload || !payload.title || !payload.category || !payload.content) {
      return sendJson(res, 400, { error: 'Dados inválidos' });
    }

    const db = readDb();
    const article = {
      id: `art_${Date.now()}`,
      title: String(payload.title).trim(),
      category: String(payload.category).trim(),
      content: String(payload.content).trim(),
      status: String(payload.status || 'draft').trim().toLowerCase(),
      author: String(payload.author || 'Equipe TSU').trim(),
      at: new Date().toISOString(),
    };
    db.cmsArticles.push(article);
    db.cmsArticles = db.cmsArticles.slice(-500);
    writeDb(db);
    return sendJson(res, 201, { ok: true, article });
  }

  if (pathname === '/api/cms/overview' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, {
      phase: 5,
      counts: {
        articles: db.cmsArticles.length,
        contacts: db.contacts.length,
        newsSuggestions: db.newsSuggestions.length,
        notifications: db.notifications.length,
      },
      latestArticles: db.cmsArticles.slice(-6).reverse(),
      latestSuggestions: db.newsSuggestions.slice(-6).reverse(),
    });
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
      phase: 5,
      counts: {
        contacts: db.contacts.length,
        newsSuggestions: db.newsSuggestions.length,
        roleRequests: db.roleRequests.length,
        analyticsEvents: db.analyticsEvents.length,
        notifications: db.notifications.length,
        cmsArticles: db.cmsArticles.length,
        creationJobs: db.creationJobs.length,
      },
      latestRoleRequests: db.roleRequests.slice(-8).reverse(),
      latestNews: db.newsSuggestions.slice(-8).reverse(),
      latestNotifications: db.notifications.slice(-8).reverse(),
      latestArticles: db.cmsArticles.slice(-8).reverse(),
      latestCreations: db.creationJobs.slice(-8).reverse(),
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
