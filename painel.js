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

  function read(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  function render() {
    const requests = read(requestsKey);
    const contacts = read(contactsKey);
    const news = read(newsKey);

    if (requestsCount) requestsCount.textContent = String(requests.length);
    if (contactsCount) contactsCount.textContent = String(contacts.length);
    if (newsCount) newsCount.textContent = String(news.length);

    if (requestsList) {
      requestsList.innerHTML = requests
        .slice(-8)
        .reverse()
        .map((r) => `<article class="panel"><p class="meta">${r.role || 'perfil'} • ${new Date(r.at).toLocaleString()}</p><h3>${r.title || 'Sem título'}</h3><p>${r.description || ''}</p><p class="small-note">${r.user || ''} ${r.email ? `(${r.email})` : ''}</p></article>`)
        .join('');
    }
  }

  function exportAll() {
    const data = {
      requests: read(requestsKey),
      contacts: read(contactsKey),
      newsSuggestions: read(newsKey),
    };
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
