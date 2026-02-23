(function () {
  const STORAGE_KEY = 'tsu_analytics_events';
  const eventsBody = document.getElementById('events-body');
  const viewsEl = document.getElementById('metric-pageviews');
  const clicksEl = document.getElementById('metric-clicks');
  const uniqueEl = document.getElementById('metric-unique');
  const totalEl = document.getElementById('metric-total');
  const sharesEl = document.getElementById('metric-shares');
  const topPagesEl = document.getElementById('top-pages-list');
  const timelineEl = document.getElementById('timeline-list');
  const runtimeStatusEl = document.getElementById('runtime-status');
  const refreshBtn = document.getElementById('refresh-analytics');
  const clearBtn = document.getElementById('clear-analytics');
  const exportBtn = document.getElementById('export-analytics');

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function readEvents() {
    try {
      const r = await fetch('/api/analytics/events');
      if (r.ok) return await r.json();
    } catch (_) {}
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  async function readSummary() {
    try {
      const r = await fetch('/api/analytics/summary');
      if (r.ok) return await r.json();
    } catch (_) {}
    return null;
  }


  async function readRuntimeStatus() {
    try {
      const r = await fetch('/api/system/status');
      if (r.ok) return await r.json();
    } catch (_) {}
    return null;
  }

  async function render() {
    const events = await readEvents();
    const pageViews = events.filter((e) => e.type === 'page_view').length;
    const clicks = events.filter((e) => e.type === 'click').length;
    const uniquePages = new Set(events.map((e) => e.page)).size;
    const shares = events.filter((e) => e.type === 'share' || e.type === 'share_copy_link').length;

    if (viewsEl) viewsEl.textContent = String(pageViews);
    if (clicksEl) clicksEl.textContent = String(clicks);
    if (uniqueEl) uniqueEl.textContent = String(uniquePages);
    if (totalEl) totalEl.textContent = String(events.length);
    if (sharesEl) sharesEl.textContent = String(shares);

    const summary = await readSummary();
    const topPages = summary?.topPages || [];
    if (topPagesEl) {
      topPagesEl.innerHTML = topPages
        .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.page)}</p><p class="metric">${item.count}</p></article>`)
        .join('');
      if (!topPages.length) {
        topPagesEl.innerHTML = '<article class="panel"><p class="small-note">Sem dados de páginas ainda.</p></article>';
      }
    }

    const timeline = summary?.timeline || [];
    if (timelineEl) {
      timelineEl.innerHTML = timeline
        .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.day)}</p><p class="metric">${item.count}</p></article>`)
        .join('');
      if (!timeline.length) {
        timelineEl.innerHTML = '<article class="panel"><p class="small-note">Sem tendência temporal disponível.</p></article>';
      }
    }

    const runtime = await readRuntimeStatus();
    if (runtimeStatusEl) {
      if (runtime) {
        const cards = [
          { label: 'Node', value: runtime.runtime?.node || 'n/d' },
          { label: 'Uptime (s)', value: String(runtime.runtime?.uptimeSeconds ?? 0) },
          { label: 'Memória RSS (MB)', value: String(Math.round((runtime.runtime?.memory?.rss || 0) / 1024 / 1024)) },
          { label: 'Cache live news', value: String(runtime.cache?.liveNewsCachedItems ?? 0) },
          { label: 'Idade do cache (s)', value: String(runtime.cache?.liveNewsCacheAgeSeconds ?? 0) },
          { label: 'Eventos analytics', value: String(runtime.counts?.analyticsEvents ?? 0) },
        ];
        runtimeStatusEl.innerHTML = cards
          .map((item) => `<article class="panel"><p class="meta">${escapeHtml(item.label)}</p><p class="metric">${escapeHtml(item.value)}</p></article>`)
          .join('');
      } else {
        runtimeStatusEl.innerHTML = '<article class="panel"><p class="small-note">Status operacional indisponível no momento.</p></article>';
      }
    }

    if (eventsBody) {
      const last = events.slice(-25).reverse();
      eventsBody.innerHTML = last
        .map(
          (e) =>
            `<tr><td>${new Date(e.at).toLocaleString()}</td><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.page)}</td><td>${escapeHtml(e.detail || '')}</td></tr>`
        )
        .join('');
    }
  }

  async function exportJson() {
    const data = JSON.stringify(await readEvents(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tsu-analytics.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  refreshBtn?.addEventListener('click', render);
  clearBtn?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    render();
  });
  exportBtn?.addEventListener('click', exportJson);

  render();
})();
