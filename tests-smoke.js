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


    const spaceMedia = await getJson('/api/media/space');
    assert(spaceMedia.res.status === 200 || spaceMedia.res.status === 503, 'space_media_unexpected_status');
    if (spaceMedia.res.status === 200) {
      assert(Array.isArray(spaceMedia.json.items), 'space_media_items_not_array');
      assert(typeof spaceMedia.json.provider === 'string', 'space_media_provider_missing');
    }

    const releaseStatus = await getJson('/api/release/status');
    assert(releaseStatus.res.status === 200, 'release_status_not_200');
    assert(typeof releaseStatus.json?.release?.version === 'string', 'release_version_missing');
    assert(Array.isArray(releaseStatus.json?.release?.checklist), 'release_checklist_invalid');

    const cmsDenied = await fetch(`${BASE_URL}/api/cms/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x', category: 'Comunicado', content: 'x', status: 'draft' }),
    });
    assert(cmsDenied.status === 403, 'cms_post_should_be_forbidden_without_admin_key');

    const cmsAllowed = await fetch(`${BASE_URL}/api/cms/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tsu-admin-key': 'tsu-local-admin',
        'x-tsu-actor': 'smoke@local',
      },
      body: JSON.stringify({ title: `Smoke CMS ${Date.now()}`, category: 'Comunicado', content: 'Validação fase 14.', status: 'draft' }),
    });
    assert(cmsAllowed.status === 201, 'cms_post_should_succeed_with_admin_key');

    const finalStatus = await getJson('/api/final/status');
    assert(finalStatus.res.status === 200, 'final_status_not_200');
    assert(typeof finalStatus.json?.final?.progress === 'number', 'final_status_progress_invalid');

    const benchmark = await getJson('/api/benchmark/summary');
    assert(benchmark.res.status === 200, 'benchmark_summary_not_200');
    assert(Array.isArray(benchmark.json?.benchmark?.categories), 'benchmark_categories_invalid');

    const supportPost = await fetch(`${BASE_URL}/api/support/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donor: 'Smoke Donor', amount: 25, currency: 'BRL', message: 'Teste fase 17' }),
    });
    assert(supportPost.status === 201, 'support_post_failed');

    const supportSummary = await getJson('/api/support/summary');
    assert(supportSummary.res.status === 200, 'support_summary_not_200');
    assert(typeof supportSummary.json?.totals?.donations === 'number', 'support_totals_invalid');

    const trustShowcase = await getJson('/api/trust/showcase');
    assert(trustShowcase.res.status === 200, 'trust_showcase_not_200');
    assert(Array.isArray(trustShowcase.json?.trust?.highlights), 'trust_showcase_highlights_invalid');

    const planningPage = await fetch(`${BASE_URL}/planejamento.html`);
    assert(planningPage.status === 200, 'planning_page_not_200');

    const architecture = await getJson('/api/architecture/status');
    assert(architecture.res.status === 200, 'architecture_status_not_200');
    assert(typeof architecture.json?.architecture?.frontend?.readiness === 'number', 'architecture_frontend_readiness_invalid');

    const search = await getJson('/api/search?q=teste&type=all');
    assert(search.res.status === 200, 'search_endpoint_not_200');
    assert(Array.isArray(search.json?.items), 'search_items_invalid');

    const aiPipeline = await getJson('/api/ai/pipeline/status');
    assert(aiPipeline.res.status === 200, 'ai_pipeline_status_not_200');
    assert(typeof aiPipeline.json?.pipeline?.totals?.jobs === 'number', 'ai_pipeline_totals_invalid');

    const marketplace = await getJson('/api/marketplace/status');
    assert(marketplace.res.status === 200, 'marketplace_status_not_200');
    assert(typeof marketplace.json?.marketplace?.totals?.demands === 'number', 'marketplace_totals_invalid');
    const payments = await getJson('/api/payments/status');
    assert(payments.res.status === 200, 'payments_status_not_200');
    assert(typeof payments.json?.payments?.totals?.transactions === 'number', 'payments_totals_invalid');
    assert(typeof payments.json?.payments?.totals?.grossBRL === 'number', 'payments_total_brl_invalid');

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
