(function () {
  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
  runPlanningSearch();
})();
