const { spawn } = require('child_process');

const BASE_URL = 'http://127.0.0.1:4173';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(retries = 20) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch (_) {}
    await wait(250);
  }
  throw new Error('server_not_ready');
}

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const json = await res.json();
  return { res, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const server = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });

  try {
    await waitForServer();

    const health = await getJson('/api/health');
    assert(health.res.status === 200, 'health_status_not_200');
    assert(health.json.ok === true, 'health_ok_false');

    const security = await getJson('/api/security/status');
    assert(security.res.status === 200, 'security_status_not_200');
    assert(security.json?.safeguards?.securityHeaders === true, 'security_headers_not_enabled');

    const dashboard = await getJson('/api/dashboard');
    assert(dashboard.res.status === 200, 'dashboard_status_not_200');
    assert(typeof dashboard.json?.counts?.analyticsEvents === 'number', 'dashboard_counts_invalid');

    const liveNews = await getJson('/api/news/live');
    assert(liveNews.res.status === 200 || liveNews.res.status === 503, 'live_news_unexpected_status');
    if (liveNews.res.status === 200) {
      assert(Array.isArray(liveNews.json.items), 'live_news_items_not_array');
      assert(typeof liveNews.json.provider === 'string', 'live_news_provider_missing');
    }

    const payload = {
      title: `Teste API ${Date.now()}`,
      summary: 'Registro automatizado da Fase 10 para verificação de pipeline local.',
    };

    const submitSuggestion = await fetch(`${BASE_URL}/api/news-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert(submitSuggestion.status === 201, 'news_suggestion_post_failed');

    const suggestions = await getJson('/api/news-suggestions');
    assert(suggestions.res.status === 200, 'news_suggestions_get_failed');
    assert(Array.isArray(suggestions.json), 'news_suggestions_not_array');

    console.log('SMOKE_TEST_OK');
  } finally {
    server.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error('SMOKE_TEST_FAIL', error.message);
  process.exit(1);
});
