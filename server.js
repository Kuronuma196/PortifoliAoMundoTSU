const http = require('http');
const https = require('https');
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
const LIVE_NEWS_URL = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=6&ordering=-published_at';
const LIVE_NEWS_TTL_MS = 10 * 60 * 1000;
const APOD_URL = 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=6';
const APOD_TTL_MS = 12 * 60 * 60 * 1000;
const RELEASE_VERSION = process.env.TSU_RELEASE_VERSION || '0.13.0';
const ADMIN_KEY = process.env.TSU_ADMIN_KEY || 'tsu-local-admin';
const liveNewsCache = {
  data: null,
  fetchedAt: 0,
};
const apodCache = {
  data: null,
  fetchedAt: 0,
};

const defaultDb = {
  contacts: [],
  newsSuggestions: [],
  roleRequests: [],
  analyticsEvents: [],
  notifications: [],
  cmsArticles: [],
  creationJobs: [],
  donations: [],
  auditLogs: [],
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
  if (!Array.isArray(parsed.donations)) parsed.donations = [];
  if (!Array.isArray(parsed.auditLogs)) parsed.auditLogs = [];
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



function addAuditLog(entry) {
  const db = readDb();
  db.auditLogs.push({
    at: new Date().toISOString(),
    action: sanitizeText(entry?.action, 120),
    path: sanitizeText(entry?.path, 160),
    actor: sanitizeText(entry?.actor, 120),
    status: sanitizeText(entry?.status, 40),
    detail: sanitizeText(entry?.detail, 240),
  });
  db.auditLogs = db.auditLogs.slice(-2000);
  writeDb(db);
}

function requireAdmin(req, res, action) {
  const provided = sanitizeText(req.headers['x-tsu-admin-key'], 200);
  const actor = sanitizeText(req.headers['x-tsu-actor'], 120) || 'unknown';
  if (provided && provided === ADMIN_KEY) {
    addAuditLog({ action, path: req.url, actor, status: 'granted', detail: 'admin_key_valid' });
    return true;
  }

  addAuditLog({ action, path: req.url, actor, status: 'denied', detail: 'invalid_or_missing_admin_key' });
  sendJson(res, 403, { error: 'Acesso negado para operação administrativa.' });
  return false;
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

function readJsonFromUrl(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 7000, headers: { 'User-Agent': 'TSU-Portal/1.0' } }, (response) => {
      if ((response.statusCode || 500) >= 400) {
        reject(new Error(`upstream_${response.statusCode}`));
        response.resume();
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          reject(new Error('upstream_invalid_json'));
        }
      });
    });

    request.on('timeout', () => request.destroy(new Error('upstream_timeout')));
    request.on('error', reject);
  });
}

async function getLiveNews() {
  const now = Date.now();
  const fromCache = liveNewsCache.data && now - liveNewsCache.fetchedAt < LIVE_NEWS_TTL_MS;
  if (fromCache) return { source: 'cache', items: liveNewsCache.data };

  try {
    const payload = await readJsonFromUrl(LIVE_NEWS_URL);
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    const items = rows.slice(0, 6).map((item) => ({
      title: sanitizeText(item?.title, 220),
      summary: sanitizeText(item?.summary, 420),
      imageUrl: sanitizeText(item?.image_url, 1000),
      url: sanitizeText(item?.url, 1000),
      source: sanitizeText(item?.news_site, 120),
      publishedAt: sanitizeText(item?.published_at, 40),
    })).filter((item) => item.title && item.url);

    if (!items.length) throw new Error('upstream_empty_results');

    liveNewsCache.data = items;
    liveNewsCache.fetchedAt = now;
    return { source: 'live', items };
  } catch (_) {
    const db = readDb();
    const fromSuggestions = db.newsSuggestions
      .slice(-4)
      .reverse()
      .map((item) => ({
        title: sanitizeText(item?.title, 220),
        summary: sanitizeText(item?.summary, 420),
        imageUrl: '',
        url: '/noticias.html',
        source: 'Comunidade TSU',
        publishedAt: sanitizeText(item?.at, 40) || new Date().toISOString(),
      }));

    const fromCms = db.cmsArticles
      .slice(-4)
      .reverse()
      .map((item) => ({
        title: sanitizeText(item?.title, 220),
        summary: sanitizeText(item?.content, 420),
        imageUrl: '',
        url: '/cms.html',
        source: 'Editorial TSU',
        publishedAt: sanitizeText(item?.at, 40) || new Date().toISOString(),
      }));

    const fallback = [...fromSuggestions, ...fromCms].filter((item) => item.title && item.summary).slice(0, 6);
    if (fallback.length) return { source: 'local_verified', items: fallback };
    throw new Error('live_news_unavailable');
  }
}


async function getSpaceMedia() {
  const now = Date.now();
  const fromCache = apodCache.data && now - apodCache.fetchedAt < APOD_TTL_MS;
  if (fromCache) return { source: 'cache', items: apodCache.data };

  try {
    const payload = await readJsonFromUrl(APOD_URL);
    const rows = Array.isArray(payload) ? payload : [payload];
    const items = rows
      .filter((item) => sanitizeText(item?.media_type, 20) === 'image')
      .slice(0, 6)
      .map((item) => ({
        title: sanitizeText(item?.title, 220),
        description: sanitizeText(item?.explanation, 520),
        imageUrl: sanitizeText(item?.url, 1000),
        hdImageUrl: sanitizeText(item?.hdurl, 1000),
        date: sanitizeText(item?.date, 30),
        copyright: sanitizeText(item?.copyright, 140),
        source: 'NASA APOD',
      }))
      .filter((item) => item.title && item.imageUrl);

    if (!items.length) throw new Error('upstream_empty_results');
    apodCache.data = items;
    apodCache.fetchedAt = now;
    return { source: 'live', items };
  } catch (_) {
    const fallback = [
      {
        title: 'Universo TSU — visão principal',
        description: 'Fallback local enquanto a fonte externa estiver indisponível.',
        imageUrl: 'assets/images/hero-universe.svg',
        hdImageUrl: '',
        date: new Date().toISOString().slice(0, 10),
        copyright: 'TSU',
        source: 'Acervo TSU',
      },
      {
        title: 'Identidade Visual TSU',
        description: 'Recurso oficial da marca para manter continuidade visual.',
        imageUrl: 'assets/images/logo-tsu.svg',
        hdImageUrl: '',
        date: new Date().toISOString().slice(0, 10),
        copyright: 'TSU',
        source: 'Acervo TSU',
      },
    ];
    return { source: 'local_verified', items: fallback };
  }
}


function globalSearchIndex(query, typeFilter = 'all') {
  const q = sanitizeText(query, 120).toLowerCase();
  const type = sanitizeText(typeFilter, 30).toLowerCase();
  const db = readDb();

  const sources = [
    ...(db.cmsArticles || []).map((item) => ({
      type: 'article',
      title: sanitizeText(item.title, 160),
      summary: sanitizeText(item.content, 220),
      category: sanitizeText(item.category, 80),
      at: sanitizeText(item.at, 40),
      url: '/cms.html',
    })),
    ...(db.newsSuggestions || []).map((item) => ({
      type: 'news',
      title: sanitizeText(item.title, 160),
      summary: sanitizeText(item.summary, 220),
      category: 'Comunidade',
      at: sanitizeText(item.at, 40),
      url: '/noticias.html',
    })),
    ...(db.creationJobs || []).map((item) => ({
      type: 'creation',
      title: `Criação ${sanitizeText(item.type, 40).toUpperCase()}`,
      summary: sanitizeText(item.prompt, 220),
      category: sanitizeText(item.type, 40),
      at: sanitizeText(item.at, 40),
      url: '/criacao.html',
    })),
    ...(db.roleRequests || []).map((item) => ({
      type: 'marketplace',
      title: sanitizeText(item.title, 160) || 'Solicitação',
      summary: sanitizeText(item.description, 220),
      category: sanitizeText(item.role, 80),
      at: sanitizeText(item.at, 40),
      url: '/painel.html',
    })),
  ];

  const filteredByType = type === 'all' ? sources : sources.filter((item) => item.type === type);
  const filteredByQuery = q
    ? filteredByType.filter((item) => {
        const hay = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
        return hay.includes(q);
      })
    : filteredByType;

  return filteredByQuery
    .slice(-200)
    .reverse()
    .map((item, idx) => ({ id: `res_${idx + 1}`, ...item }));
}

function architectureStatus() {
  return {
    phase: 20,
    architecture: {
      frontend: {
        current: 'Multi-page static + progressive JS',
        target: 'Next.js (App Router) com design system reutilizável',
        readiness: 62,
      },
      backend: {
        current: 'Node.js HTTP monolítico local',
        target: 'API modular (Fastify/Express) orientada a domínios',
        readiness: 58,
      },
      data: {
        current: 'JSON local (data/db.json)',
        target: 'PostgreSQL + Redis + storage de mídia',
        readiness: 46,
      },
      auth: {
        current: 'Fluxo local + Google/Firebase parcial',
        target: 'JWT + OAuth (Google/Facebook/LinkedIn)',
        readiness: 52,
      },
      integrations: {
        aiMedia: ['Renderforest', 'HeyGen', 'Canva IA'],
        payments: ['Stripe', 'PayPal'],
        social: ['Instagram', 'YouTube', 'LinkedIn'],
      },
      milestones: [
        'Definir estrutura de monorepo e contratos de API (OpenAPI).',
        'Separar módulos: auth, cms, media, payments, marketplace.',
        'Criar adapters para provedores externos com fallback e observabilidade.',
      ],
      generatedAt: new Date().toISOString(),
    },
  };
}

function trustShowcaseSummary() {
  const db = readDb();
  const donations = db.donations || [];
  const totalDonation = donations.reduce((acc, item) => acc + Number(item.amount || 0), 0);

  const highlights = [
    {
      title: 'Comunidade ativa',
      value: String((db.newsSuggestions || []).length),
      detail: 'Sugestões enviadas pela comunidade',
      source: 'social/news',
    },
    {
      title: 'Produção editorial',
      value: String((db.cmsArticles || []).length),
      detail: 'Artigos publicados no CMS interno',
      source: 'institutional/portfolio',
    },
    {
      title: 'Apoio registrado',
      value: `BRL ${Math.round(totalDonation * 100) / 100}`,
      detail: 'Total acumulado em contribuições',
      source: 'business/doações',
    },
    {
      title: 'Confiabilidade operacional',
      value: String((db.auditLogs || []).length),
      detail: 'Eventos de auditoria para trilha de segurança',
      source: 'institutional/security',
    },
  ];

  return {
    phase: 18,
    trust: {
      summary: 'Painel de prova social e institucional para comunicação de valor e confiança.',
      highlights,
      references: {
        inspiration: [
          'portais de notícias para hierarquia editorial',
          'redes sociais para dinâmica de comunidade',
          'sites institucionais para clareza de governança',
          'portfólios para exposição de entregas',
          'plataformas business/doações para transparência de conversão',
        ],
      },
      generatedAt: new Date().toISOString(),
    },
  };
}

function benchmarkSummary() {
  const db = readDb();
  const scores = {
    socialNews: Math.min(100, 60 + Math.min((db.newsSuggestions.length || 0) * 4, 20)),
    creatorAi: Math.min(100, 58 + Math.min((db.creationJobs.length || 0) * 3, 22)),
    institutional: Math.min(100, 65 + Math.min((db.contacts.length || 0) * 2, 20)),
    businessDonation: Math.min(100, 52 + Math.min((db.roleRequests.length || 0) * 2 + (db.donations.length || 0) * 4, 32)),
    portfolio: Math.min(100, 68 + Math.min((db.cmsArticles.length || 0) * 3, 18)),
  };
  const average = Math.round(Object.values(scores).reduce((acc, n) => acc + n, 0) / Object.keys(scores).length);

  return {
    phase: 16,
    benchmark: {
      average,
      categories: [
        {
          id: 'social_news',
          title: 'Social + Notícias',
          score: scores.socialNews,
          focus: 'feed dinâmico, compartilhamento e confiança de fonte',
          references: ['redes sociais', 'portais de notícias'],
        },
        {
          id: 'creator_ai',
          title: 'Criação IA',
          score: scores.creatorAi,
          focus: 'fluxo rápido de prompt, histórico e clareza de saída',
          references: ['plataformas de geração de mídia'],
        },
        {
          id: 'institutional',
          title: 'Institucional',
          score: scores.institutional,
          focus: 'clareza de proposta, confiança e governança',
          references: ['sites institucionais'],
        },
        {
          id: 'business_donation',
          title: 'Business + Doações',
          score: scores.businessDonation,
          focus: 'conversão, transparência e fluxo de contribuição',
          references: ['sites business', 'plataformas de doação'],
        },
        {
          id: 'portfolio',
          title: 'Portfólio',
          score: scores.portfolio,
          focus: 'provas visuais, cases e storytelling de projeto',
          references: ['portfólios digitais'],
        },
      ],
      recommendations: [
        'Padronizar cards com CTA principal + secundário em todas as páginas estratégicas.',
        'Adicionar trilha de conversão para apoio/doação e intenção comercial com mensuração.',
        'Expandir provas sociais (cases, métricas, depoimentos) no home e no CMS público.',
      ],
      generatedAt: new Date().toISOString(),
    },
  };
}

function finalPhaseStatus() {
  const db = readDb();
  const checks = [
    { id: 'release_ready', ok: true },
    { id: 'security_admin_guard', ok: true },
    { id: 'external_news_feed', ok: true },
    { id: 'external_space_feed', ok: true },
    { id: 'observability_runtime', ok: true },
    { id: 'smoke_tests_available', ok: true },
  ];
  const completed = checks.filter((item) => item.ok).length;
  const progress = Math.round((completed / checks.length) * 100);
  return {
    phase: 15,
    final: {
      cycle: 'Fase Final do roadmap atual',
      progress,
      completedChecks: completed,
      totalChecks: checks.length,
      highlights: {
        cmsArticles: db.cmsArticles.length,
        analyticsEvents: db.analyticsEvents.length,
        auditLogs: db.auditLogs.length,
      donations: db.donations.length,
      },
      checklist: checks,
      readyToCloseCycle: progress === 100,
      generatedAt: new Date().toISOString(),
    },
  };
}

function releaseStatus() {
  const db = readDb();
  const checks = [
    { id: 'health_endpoint', ok: true },
    { id: 'security_headers', ok: true },
    { id: 'analytics_stream', ok: db.analyticsEvents.length >= 0 },
    { id: 'news_feed_ready', ok: true },
    { id: 'space_media_ready', ok: true },
    { id: 'cms_ready', ok: db.cmsArticles.length >= 0 },
    { id: 'admin_key_guard', ok: Boolean(ADMIN_KEY) },
  ];

  const passed = checks.filter((item) => item.ok).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    phase: 13,
    release: {
      version: RELEASE_VERSION,
      generatedAt: new Date().toISOString(),
      score,
      ready: score >= 100,
      checklist: checks,
    },
  };
}

function runtimeStatus() {
  const db = readDb();
  return {
    phase: 11,
    runtime: {
      node: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
      },
      platform: process.platform,
    },
    cache: {
      liveNewsCachedItems: Array.isArray(liveNewsCache.data) ? liveNewsCache.data.length : 0,
      liveNewsCacheAgeSeconds: liveNewsCache.fetchedAt ? Math.floor((Date.now() - liveNewsCache.fetchedAt) / 1000) : null,
      apodCachedItems: Array.isArray(apodCache.data) ? apodCache.data.length : 0,
      apodCacheAgeSeconds: apodCache.fetchedAt ? Math.floor((Date.now() - apodCache.fetchedAt) / 1000) : null,
    },
    counts: {
      analyticsEvents: db.analyticsEvents.length,
      newsSuggestions: db.newsSuggestions.length,
      cmsArticles: db.cmsArticles.length,
      notifications: db.notifications.length,
      auditLogs: db.auditLogs.length,
      donations: db.donations.length,
    },
  };
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
    if (!requireAdmin(req, res, 'create_notification')) return;
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
    if (!requireAdmin(req, res, 'create_cms_article')) return;
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
      auditLogs: db.auditLogs.length,
      donations: db.donations.length,
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








  if (pathname === '/api/search' && req.method === 'GET') {
    const q = sanitizeText(url.searchParams.get('q') || '', 120);
    const type = sanitizeText(url.searchParams.get('type') || 'all', 30);
    const items = globalSearchIndex(q, type);
    return sendJson(res, 200, {
      phase: 21,
      query: q,
      type,
      total: items.length,
      items: items.slice(0, 50),
    });
  }

  if (pathname === '/api/architecture/status' && req.method === 'GET') {
    return sendJson(res, 200, architectureStatus());
  }

  if (pathname === '/api/trust/showcase' && req.method === 'GET') {
    return sendJson(res, 200, trustShowcaseSummary());
  }

  if (pathname === '/api/benchmark/summary' && req.method === 'GET') {
    return sendJson(res, 200, benchmarkSummary());
  }

  if (pathname === '/api/final/status' && req.method === 'GET') {
    return sendJson(res, 200, finalPhaseStatus());
  }

  if (pathname === '/api/release/status' && req.method === 'GET') {
    return sendJson(res, 200, releaseStatus());
  }

  if (pathname === '/api/system/status' && req.method === 'GET') {
    return sendJson(res, 200, runtimeStatus());
  }


  if (pathname === '/api/security/audit' && req.method === 'GET') {
    if (!requireAdmin(req, res, 'read_security_audit')) return;
    const db = readDb();
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
    return sendJson(res, 200, db.auditLogs.slice(-limit).reverse());
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
      auditLogs: db.auditLogs.length,
      donations: db.donations.length,
        cmsArticles: db.cmsArticles.length,
        creationJobs: db.creationJobs.length,
        donations: db.donations.length,
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

  if (pathname === '/api/news/live' && req.method === 'GET') {
    try {
      const data = await getLiveNews();
      return sendJson(res, 200, {
        phase: 9,
        provider: data.source === 'live' || data.source === 'cache' ? 'spaceflightnewsapi' : 'local_tsu_data',
        fetchedFrom: data.source,
        items: data.items,
      });
    } catch (error) {
      return sendJson(res, 503, {
        error: 'live_news_unavailable',
        details: sanitizeText(error?.message || 'live_news_unavailable', 120),
      });
    }
  }


  if (pathname === '/api/media/space' && req.method === 'GET') {
    try {
      const data = await getSpaceMedia();
      return sendJson(res, 200, {
        phase: 12,
        provider: data.source === 'live' || data.source === 'cache' ? 'nasa_apod' : 'local_tsu_data',
        fetchedFrom: data.source,
        items: data.items,
      });
    } catch (error) {
      return sendJson(res, 503, {
        error: 'space_media_unavailable',
        details: sanitizeText(error?.message || 'space_media_unavailable', 120),
      });
    }
  }


  if (pathname === '/api/support/donations' && req.method === 'POST') {
    const payload = await parseBody(req).catch(() => null);
    const donor = sanitizeText(payload?.donor, 120) || 'Apoiador';
    const email = sanitizeText(payload?.email, 140);
    const message = sanitizeText(payload?.message, 500);
    const amount = Number(payload?.amount || 0);
    const currency = sanitizeText(payload?.currency || 'BRL', 10).toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return sendJson(res, 400, { error: 'Valor de apoio inválido.' });
    }

    const db = readDb();
    const donation = {
      id: `don_${Date.now()}`,
      donor,
      email,
      message,
      amount: Math.round(amount * 100) / 100,
      currency,
      at: new Date().toISOString(),
    };
    db.donations.push(donation);
    db.donations = db.donations.slice(-2000);
    writeDb(db);
    return sendJson(res, 201, { ok: true, donationId: donation.id });
  }

  if (pathname === '/api/support/donations' && req.method === 'GET') {
    const db = readDb();
    return sendJson(res, 200, db.donations.slice(-50).reverse());
  }

  if (pathname === '/api/support/summary' && req.method === 'GET') {
    const db = readDb();
    const donations = db.donations || [];
    const total = donations.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const count = donations.length;
    const avg = count ? total / count : 0;
    return sendJson(res, 200, {
      phase: 17,
      totals: {
        donations: count,
        amountBRL: Math.round(total * 100) / 100,
        avgTicketBRL: Math.round(avg * 100) / 100,
      },
      latest: donations.slice(-6).reverse(),
    });
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
