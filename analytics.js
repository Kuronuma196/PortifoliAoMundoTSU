(function () {
  const STORAGE_KEY = 'tsu_analytics_events';
  const eventsBody = document.getElementById('events-body');
  const viewsEl = document.getElementById('metric-pageviews');
  const clicksEl = document.getElementById('metric-clicks');
  const uniqueEl = document.getElementById('metric-unique');
  const refreshBtn = document.getElementById('refresh-analytics');
  const clearBtn = document.getElementById('clear-analytics');

  function readEvents() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function render() {
    const events = readEvents();
    const pageViews = events.filter((e) => e.type === 'page_view').length;
    const clicks = events.filter((e) => e.type === 'click').length;
    const uniquePages = new Set(events.map((e) => e.page)).size;

    if (viewsEl) viewsEl.textContent = String(pageViews);
    if (clicksEl) clicksEl.textContent = String(clicks);
    if (uniqueEl) uniqueEl.textContent = String(uniquePages);

    if (eventsBody) {
      const last = events.slice(-25).reverse();
      eventsBody.innerHTML = last
        .map((e) => `<tr><td>${new Date(e.at).toLocaleString()}</td><td>${e.type}</td><td>${e.page}</td><td>${e.detail || ''}</td></tr>`)
        .join('');
    }
  }

  refreshBtn?.addEventListener('click', render);
  clearBtn?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    render();
  });

  render();
})();
