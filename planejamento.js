(function () {
  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }




  async function renderPaymentsStatus() {
    const totalsEl = document.getElementById('planning-payments-totals');
    const providersEl = document.getElementById('planning-payments-providers');
    const milestonesEl = document.getElementById('planning-payments-milestones');
    if (!totalsEl || !providersEl || !milestonesEl) return;

    try {
      const response = await fetch('/api/payments/status');
      if (!response.ok) throw new Error('payments_status_failed');
      const data = await response.json();
      const totals = data?.payments?.totals || {};
      const providers = Array.isArray(data?.payments?.providers) ? data.payments.providers : [];
      const milestones = Array.isArray(data?.payments?.milestones) ? data.payments.milestones : [];
      const byCurrency = totals?.byCurrency && typeof totals.byCurrency === 'object' ? totals.byCurrency : {};

      const totalsCards = [
        ['Transações válidas', totals.transactions || 0],
        ['Total BRL', `R$ ${Number(totals.grossBRL || 0).toFixed(2)}`],
        ['Ticket médio BRL', `R$ ${Number(totals.avgTicketBRL || 0).toFixed(2)}`],
        ['Última doação', totals.latestDonationAt ? new Date(totals.latestDonationAt).toLocaleString() : 'N/D'],
      ];

      const currencyCards = Object.entries(byCurrency)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, total]) => ['Moeda ' + code, Number(total || 0).toFixed(2)]);

      totalsEl.innerHTML = totalsCards
        .concat(currencyCards)
        .map(([label, value]) => `<article class="panel"><p class="meta">${escapeHtml(label)}</p><p class="metric">${escapeHtml(String(value))}</p></article>`)
        .join('');

      providersEl.innerHTML = providers.length
        ? providers
            .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.id || 'provider')}</p><p><strong>Status:</strong> ${escapeHtml(item.status || 'n/d')}</p><p><strong>Readiness:</strong> ${escapeHtml(String(item.readiness || 0))}%</p></article>`)
            .join('')
        : '<article class="panel"><p class="small-note">Sem provedores mapeados.</p></article>';

      milestonesEl.innerHTML = `<article class="panel"><h3>Próximos marcos de pagamentos</h3><ul class="list">${milestones
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul></article>`;
    } catch (_) {
      totalsEl.innerHTML = '<article class="panel"><p class="small-note">Status de pagamentos indisponível.</p></article>';
      providersEl.innerHTML = '';
      milestonesEl.innerHTML = '';
    }
  }

  async function renderMarketplaceStatus() {
    const totalsEl = document.getElementById('planning-marketplace-totals');
    const rolesEl = document.getElementById('planning-marketplace-roles');
    const latestEl = document.getElementById('planning-marketplace-latest');
    if (!totalsEl || !rolesEl || !latestEl) return;

    try {
      const response = await fetch('/api/marketplace/status');
      if (!response.ok) throw new Error('marketplace_status_failed');
      const data = await response.json();
      const totals = data?.marketplace?.totals || {};
      const roles = Array.isArray(data?.marketplace?.topRoles) ? data.marketplace.topRoles : [];
      const latest = Array.isArray(data?.marketplace?.latestDemands) ? data.marketplace.latestDemands : [];

      totalsEl.innerHTML = [
        ['Demandas totais', totals.demands || 0],
        ['Perfis únicos', totals.uniqueRoles || 0],
      ]
        .map(([label, value]) => `<article class="panel"><p class="meta">${escapeHtml(label)}</p><p class="metric">${escapeHtml(String(value))}</p></article>`)
        .join('');

      rolesEl.innerHTML = roles.length
        ? roles
            .map((item) => `<article class="panel"><p class="meta">Perfil</p><h3>${escapeHtml(item.role || 'N/D')}</h3><p class="metric">${escapeHtml(String(item.count || 0))}</p></article>`)
            .join('')
        : '<article class="panel"><p class="small-note">Sem perfis mapeados no momento.</p></article>';

      latestEl.innerHTML = latest.length
        ? latest
            .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.role || 'perfil')} • ${item.at ? new Date(item.at).toLocaleString() : ''}</p><h3>${escapeHtml(item.title || 'Demanda')}</h3><p>${escapeHtml(item.description || '')}</p></article>`)
            .join('')
        : '<article class="panel"><p class="small-note">Sem demandas recentes.</p></article>';
    } catch (_) {
      totalsEl.innerHTML = '<article class="panel"><p class="small-note">Status do marketplace indisponível.</p></article>';
      rolesEl.innerHTML = '';
      latestEl.innerHTML = '';
    }
  }

  async function renderAiPipelineStatus() {
    const totalsEl = document.getElementById('planning-ai-totals');
    const providersEl = document.getElementById('planning-ai-providers');
    const milestonesEl = document.getElementById('planning-ai-milestones');
    if (!totalsEl || !providersEl || !milestonesEl) return;

    try {
      const response = await fetch('/api/ai/pipeline/status');
      if (!response.ok) throw new Error('ai_pipeline_failed');
      const data = await response.json();
      const totals = data?.pipeline?.totals || {};
      const providers = Array.isArray(data?.pipeline?.providers) ? data.pipeline.providers : [];
      const milestones = Array.isArray(data?.pipeline?.nextMilestones) ? data.pipeline.nextMilestones : [];

      const cards = [
        ['Jobs totais', totals.jobs || 0],
        ['Texto', totals.text || 0],
        ['Imagem', totals.image || 0],
        ['Vídeo', totals.video || 0],
      ];
      totalsEl.innerHTML = cards
        .map(([label, value]) => `<article class="panel"><p class="meta">${escapeHtml(label)}</p><p class="metric">${escapeHtml(String(value))}</p></article>`)
        .join('');

      providersEl.innerHTML = providers.length
        ? providers
            .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.id)}</p><p><strong>Domínio:</strong> ${escapeHtml(item.domain || '')}</p><p><strong>Status:</strong> ${escapeHtml(item.status || '')}</p></article>`)
            .join('')
        : '<article class="panel"><p class="small-note">Sem provedores cadastrados.</p></article>';

      milestonesEl.innerHTML = `<article class="panel"><h3>Próximos marcos IA</h3><ul class="list">${milestones
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul></article>`;
    } catch (_) {
      totalsEl.innerHTML = '<article class="panel"><p class="small-note">Pipeline IA indisponível no momento.</p></article>';
      providersEl.innerHTML = '';
      milestonesEl.innerHTML = '';
    }
  }

  async function runPlanningSearch() {
    const qInput = document.getElementById('planning-search-q');
    const typeInput = document.getElementById('planning-search-type');
    const results = document.getElementById('planning-search-results');
    const trigger = document.getElementById('planning-search-btn');
    if (!qInput || !typeInput || !results || !trigger) return;

    const execute = async () => {
      const q = qInput.value.trim();
      const type = typeInput.value;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`);
        if (!response.ok) throw new Error('planning_search_failed');
        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        results.innerHTML = items.length
          ? items
              .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.type)} • ${escapeHtml(item.category || '')}</p><h3>${escapeHtml(item.title || 'Resultado')}</h3><p>${escapeHtml(item.summary || '')}</p><p class="small-note">${item.at ? new Date(item.at).toLocaleString() : ''}</p><a class="button ghost" href="${escapeHtml(item.url || '/index.html')}">Abrir</a></article>`)
              .join('')
          : '<article class="panel"><p class="small-note">Nenhum resultado encontrado.</p></article>';
      } catch (_) {
        results.innerHTML = '<article class="panel"><p class="small-note">Falha ao executar busca.</p></article>';
      }
    };

    trigger.addEventListener('click', execute);
  }

  async function renderArchitectureStatus() {
    const cards = document.getElementById('architecture-status-cards');
    const milestones = document.getElementById('architecture-milestones');
    if (!cards || !milestones) return;

    try {
      const response = await fetch('/api/architecture/status');
      if (!response.ok) throw new Error('architecture_status_failed');
      const data = await response.json();
      const arch = data?.architecture || {};

      const modules = [
        ['Front-end', arch.frontend],
        ['Back-end', arch.backend],
        ['Dados', arch.data],
        ['Autenticação', arch.auth],
      ];

      cards.innerHTML = modules
        .map(([label, mod]) => {
          const readiness = Number(mod?.readiness || 0);
          return `<article class="panel"><p class="meta">${escapeHtml(label)}</p><p class="metric">${escapeHtml(String(readiness))}%</p><p><strong>Atual:</strong> ${escapeHtml(mod?.current || 'n/d')}</p><p><strong>Alvo:</strong> ${escapeHtml(mod?.target || 'n/d')}</p></article>`;
        })
        .join('');

      const milestonesList = Array.isArray(arch.milestones) ? arch.milestones : [];
      milestones.innerHTML = `<article class="panel"><h3>Próximos marcos técnicos</h3><ul class="list">${milestonesList
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul></article>`;
    } catch (_) {
      cards.innerHTML = '<article class="panel"><p class="small-note">Status arquitetural indisponível no momento.</p></article>';
      milestones.innerHTML = '';
    }
  }

  renderArchitectureStatus();
  renderAiPipelineStatus();
  renderPaymentsStatus();
  renderMarketplaceStatus();
  runPlanningSearch();
})();
