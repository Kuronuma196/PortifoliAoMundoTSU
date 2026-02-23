(function () {
  const requestsKey = 'tsu_role_requests';
  const contactsKey = 'tsu_contact_messages';
  const newsKey = 'tsu_news_suggestions';

  const requestsCount = document.getElementById('panel-requests-count');
  const contactsCount = document.getElementById('panel-contacts-count');
  const newsCount = document.getElementById('panel-news-count');
  const notificationsCount = document.getElementById('panel-notifications-count');
  const cmsCount = document.getElementById('panel-cms-count');
  const requestsList = document.getElementById('panel-requests-list');
  const notificationsList = document.getElementById('panel-notifications-list');
  const cmsList = document.getElementById('panel-cms-list');
  const refreshBtn = document.getElementById('panel-refresh');
  const exportBtn = document.getElementById('panel-export');

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function localData() {
    return {
      requests: JSON.parse(localStorage.getItem(requestsKey) || '[]'),
      contacts: JSON.parse(localStorage.getItem(contactsKey) || '[]'),
      newsSuggestions: JSON.parse(localStorage.getItem(newsKey) || '[]'),
      notifications: JSON.parse(localStorage.getItem('tsu_notifications') || '[]'),
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
          notifications: d.latestNotifications || [],
          articles: d.latestArticles || [],
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
        notifications: local.notifications.length,
        cmsArticles: 0,
      },
    };
  }

  async function render() {
    const data = await readDashboard();

    if (requestsCount) requestsCount.textContent = String(data.counts.roleRequests ?? data.requests.length);
    if (contactsCount) contactsCount.textContent = String(data.counts.contacts ?? data.contacts.length);
    if (newsCount) newsCount.textContent = String(data.counts.newsSuggestions ?? data.newsSuggestions.length);
    if (notificationsCount) notificationsCount.textContent = String(data.counts.notifications ?? data.notifications.length);
    if (cmsCount) cmsCount.textContent = String(data.counts.cmsArticles ?? (data.articles?.length || 0));

    if (requestsList) {
      requestsList.innerHTML = (data.requests || [])
        .slice(0, 8)
        .map(
          (r) =>
            `<article class="panel"><p class="meta">${escapeHtml(r.role || 'perfil')} • ${r.at ? new Date(r.at).toLocaleString() : ''}</p><h3>${escapeHtml(r.title || 'Sem título')}</h3><p>${escapeHtml(r.description || '')}</p><p class="small-note">${escapeHtml(r.user || '')} ${r.email ? `(${escapeHtml(r.email)})` : ''}</p></article>`
        )
        .join('');
    }

    if (notificationsList) {
      notificationsList.innerHTML = (data.notifications || [])
        .slice(0, 8)
        .map(
          (n) =>
            `<article class="panel"><p class="meta">${escapeHtml(n.source || 'portal')} • ${n.at ? new Date(n.at).toLocaleString() : ''}</p><h3>${escapeHtml(n.title || 'Notificação')}</h3><p>${escapeHtml(n.message || '')}</p><p class="small-note">Audiência: ${escapeHtml(n.audience || 'all')}</p></article>`
        )
        .join('');
      if (!data.notifications?.length) {
        notificationsList.innerHTML = '<article class="panel"><p class="small-note">Nenhuma notificação registrada até o momento.</p></article>';
      }
    }

    if (cmsList) {
      cmsList.innerHTML = (data.articles || [])
        .slice(0, 8)
        .map(
          (a) =>
            `<article class="panel"><p class="meta">${escapeHtml(a.category || 'Conteúdo')} • ${a.at ? new Date(a.at).toLocaleString() : ''}</p><h3>${escapeHtml(a.title || 'Artigo')}</h3><p>${escapeHtml(a.content || '')}</p><p class="small-note">Status: ${escapeHtml(a.status || 'draft')}</p></article>`
        )
        .join('');
      if (!data.articles?.length) {
        cmsList.innerHTML = '<article class="panel"><p class="small-note">Nenhum artigo CMS registrado.</p></article>';
      }
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
