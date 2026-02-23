const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const MAX_BODY_BYTES = 1_000_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const rateMap = new Map();

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

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

function sendJson(res, code, data) {
  res.writeHead(code, securityHeaders());
  res.end(JSON.stringify(data));
}

function sanitizeText(value, max = 3000) {
  return String(value || '').trim().slice(0, max);
}

function allowRateLimit(req) {
  const ip = String(req.socket.remoteAddress || 'local');
  const now = Date.now();
  const current = rateMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > current.resetAt) {
    const refreshed = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateMap.set(ip, refreshed);
    return true;
  }

  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  rateMap.set(ip, current);
  return true;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;

    req.on('data', (c) => {
      bytes += c.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      raw += c;
    });

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
    res.writeHead(404, securityHeaders('text/plain; charset=utf-8'));
    res.end('Not Found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, securityHeaders(mime[ext] || 'application/octet-stream'));
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'POST' && !allowRateLimit(req)) {
    return sendJson(res, 429, { error: 'Muitas requisições. Tente novamente em instantes.' });
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, phase: 7, message: 'Fase 7 ativa: hardening final + design system estabilizado' });
  }

  if (pathname === '/api/security/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      phase: 7,
      safeguards: {
        securityHeaders: true,
        requestRateLimit: { enabled: true, limitPerMinute: RATE_LIMIT },
        payloadLimitBytes: MAX_BODY_BYTES,
      },
    });
  }

  if (pathname === '/api/auth/employee-whitelist' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, { emails: db.auth.employeeWhitelist });
  }

  if (pathname === '/api/notifications' && req.method === 'GET') {
    const audience = sanitizeText(url.searchParams.get('audience') || '', 30).toLowerCase();
    const db = readDb();
    const filtered = audience ? db.notifications.filter((n) => n.audience === 'all' || n.audience === audience) : db.notifications;
    return sendJson(res, 200, filtered.slice(-50).reverse());
  }

  if (pathname === '/api/notifications' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const title = sanitizeText(payload?.title, 120);
    const message = sanitizeText(payload?.message, 1200);
    if (!title || !message) return sendJson(res, 400, { error: 'Dados inválidos' });

    const db = readDb();
    db.notifications.push({
      title,
      message,
      audience: sanitizeText(payload?.audience || 'all', 20).toLowerCase(),
      source: sanitizeText(payload?.source || 'portal', 50),
      at: new Date().toISOString(),
    });
    db.notifications = db.notifications.slice(-500);
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/creation/generate' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const type = sanitizeText(payload?.type, 20).toLowerCase();
    const prompt = sanitizeText(payload?.prompt, 1000);
    if (!type || !prompt) return sendJson(res, 400, { error: 'Dados inválidos' });

    const job = {
      id: `job_${Date.now()}`,
      type,
      prompt,
      at: new Date().toISOString(),
      status: 'completed',
      output: {},
    };

    if (type === 'text') {
      job.output = { text: `Versão inicial gerada para: ${prompt}`, excerpt: `Resumo criativo: ${prompt.slice(0, 140)}` };
    } else if (type === 'image') {
      job.output = { url: 'assets/images/hero-universe.svg', caption: `Conceito visual para: ${prompt}` };
    } else if (type === 'video') {
      job.output = { status: 'pending_provider_integration', storyboard: `Storyboard base para: ${prompt}`, provider: null };
    } else if (type === 'audio') {
      job.output = { status: 'pending_provider_integration', notes: `Guia sonoro para: ${prompt}`, provider: null };
    } else {
      return sendJson(res, 400, { error: 'Tipo de geração inválido' });
    }

    const db = readDb();
    db.creationJobs.push(job);
    db.creationJobs = db.creationJobs.slice(-500);
    writeDb(db);
    return sendJson(res, 201, { ok: true, jobId: job.id, output: job.output, phase: 7 });
  }

  if (pathname === '/api/cms/articles' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, db.cmsArticles.slice(-80).reverse());
  }

  if (pathname === '/api/cms/articles' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const title = sanitizeText(payload?.title, 160);
    const category = sanitizeText(payload?.category, 80);
    const content = sanitizeText(payload?.content, 3000);
    if (!title || !category || !content) return sendJson(res, 400, { error: 'Dados inválidos' });

    const db = readDb();
    const article = {
      id: `art_${Date.now()}`,
      title,
      category,
      content,
      status: sanitizeText(payload?.status || 'draft', 20).toLowerCase(),
      author: sanitizeText(payload?.author || 'Equipe TSU', 120),
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
      phase: 7,
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
    const name = sanitizeText(payload?.name, 120);
    const email = sanitizeText(payload?.email, 140);
    const message = sanitizeText(payload?.message, 2000);
    if (!name || !email || !message) return sendJson(res, 400, { error: 'Dados inválidos' });

    const db = readDb();
    db.contacts.push({ name, email, type: sanitizeText(payload?.type, 60), message, at: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/news-suggestions' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const title = sanitizeText(payload?.title, 160);
    const summary = sanitizeText(payload?.summary, 2000);
    if (!title || !summary) return sendJson(res, 400, { error: 'Dados inválidos' });

    const db = readDb();
    db.newsSuggestions.push({ title, summary, at: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/role-requests' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const role = sanitizeText(payload?.role, 60);
    const title = sanitizeText(payload?.title, 160);
    const description = sanitizeText(payload?.description, 2000);
    if (!role || !title || !description) return sendJson(res, 400, { error: 'Dados inválidos' });

    const db = readDb();
    db.roleRequests.push({
      role,
      title,
      description,
      email: sanitizeText(payload?.email, 140),
      user: sanitizeText(payload?.user, 120),
      at: new Date().toISOString(),
    });
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/analytics/events' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const type = sanitizeText(payload?.type, 80);
    if (!type) return sendJson(res, 400, { error: 'Dados inválidos' });

    const db = readDb();
    db.analyticsEvents.push({
      type,
      page: sanitizeText(payload?.page, 120),
      detail: sanitizeText(payload?.detail, 300),
      at: sanitizeText(payload?.at, 40) || new Date().toISOString(),
    });
    db.analyticsEvents = db.analyticsEvents.slice(-2000);
    writeDb(db);
    return sendJson(res, 201, { ok: true });
  }

  if (pathname === '/api/analytics/summary' && req.method === 'GET') {
    const db = readDb();
    const events = db.analyticsEvents || [];
    const byType = {};
    const byPage = {};

    events.forEach((event) => {
      const type = String(event.type || 'unknown');
      const page = String(event.page || 'unknown');
      byType[type] = (byType[type] || 0) + 1;
      byPage[page] = (byPage[page] || 0) + 1;
    });

    const topPages = Object.entries(byPage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([page, count]) => ({ page, count }));

    const recent = events.slice(-40);
    const days = {};
    recent.forEach((event) => {
      const day = String(event.at || '').slice(0, 10) || 'sem-data';
      days[day] = (days[day] || 0) + 1;
    });

    const timeline = Object.entries(days)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count }));

    return sendJson(res, 200, {
      phase: 7,
      totals: {
        events: events.length,
        pageViews: byType.page_view || 0,
        clicks: byType.click || 0,
        shares: (byType.share || 0) + (byType.share_copy_link || 0),
      },
      byType,
      topPages,
      timeline,
    });
  }

  if (pathname === '/api/dashboard' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, {
      phase: 7,
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
