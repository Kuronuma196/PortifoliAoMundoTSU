(function () {
  const requestsKey = 'tsu_role_requests';
  const contactsKey = 'tsu_contact_messages';
  const newsKey = 'tsu_news_suggestions';

  const requestsCount = document.getElementById('panel-requests-count');
  const contactsCount = document.getElementById('panel-contacts-count');
  const newsCount = document.getElementById('panel-news-count');
  const requestsList = document.getElementById('panel-requests-list');
  const refreshBtn = document.getElementById('panel-refresh');
  const exportBtn = document.getElementById('panel-export');

  function localData() {
    return {
      requests: JSON.parse(localStorage.getItem(requestsKey) || '[]'),
      contacts: JSON.parse(localStorage.getItem(contactsKey) || '[]'),
      newsSuggestions: JSON.parse(localStorage.getItem(newsKey) || '[]'),
    };
  }

  async function readDashboard() {
    try {
      const r = await fetch('/api/dashboard');
      if (r.ok) {
        const d = await r.json();
        return {
          requests: d.latestRoleRequests || [],
          contacts: Array(d.counts?.contacts || 0).fill({}),
          newsSuggestions: d.latestNews || [],
          counts: d.counts || {},
        };
      }
    } catch (_) {}
    const local = localData();
    return {
      ...local,
      counts: {
        contacts: local.contacts.length,
        newsSuggestions: local.newsSuggestions.length,
        roleRequests: local.requests.length,
      },
    };
  }

  async function render() {
    const data = await readDashboard();

    if (requestsCount) requestsCount.textContent = String(data.counts.roleRequests ?? data.requests.length);
    if (contactsCount) contactsCount.textContent = String(data.counts.contacts ?? data.contacts.length);
    if (newsCount) newsCount.textContent = String(data.counts.newsSuggestions ?? data.newsSuggestions.length);

    if (requestsList) {
      requestsList.innerHTML = (data.requests || [])
        .slice(0, 8)
        .map((r) => `<article class="panel"><p class="meta">${r.role || 'perfil'} • ${r.at ? new Date(r.at).toLocaleString() : ''}</p><h3>${r.title || 'Sem título'}</h3><p>${r.description || ''}</p><p class="small-note">${r.user || ''} ${r.email ? `(${r.email})` : ''}</p></article>`)
        .join('');
    }
  }

  function exportAll() {
    const data = localData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tsu-operacional-local.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  refreshBtn?.addEventListener('click', render);
  exportBtn?.addEventListener('click', exportAll);

  render();
})();
