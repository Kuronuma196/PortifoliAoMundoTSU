(function () {
  const form = document.getElementById('cms-article-form');
  const feedback = document.getElementById('cms-feedback');
  const list = document.getElementById('cms-articles-list');
  const suggestionsList = document.getElementById('cms-suggestions-list');

  const titleInput = document.getElementById('cms-title');
  const categoryInput = document.getElementById('cms-category');
  const statusInput = document.getElementById('cms-status');
  const contentInput = document.getElementById('cms-content');

  const countArticles = document.getElementById('cms-count-articles');
  const countSuggestions = document.getElementById('cms-count-suggestions');
  const countNotifications = document.getElementById('cms-count-notifications');
  const countContacts = document.getElementById('cms-count-contacts');

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function fetchOverview() {
    const r = await fetch('/api/cms/overview');
    if (!r.ok) throw new Error('overview_failed');
    return r.json();
  }

  async function fetchArticles() {
    const r = await fetch('/api/cms/articles');
    if (!r.ok) throw new Error('articles_failed');
    return r.json();
  }

  async function createArticle(payload) {
    const r = await fetch('/api/cms/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  }

  async function renderOverview() {
    try {
      const data = await fetchOverview();

      if (countArticles) countArticles.textContent = String(data?.counts?.articles || 0);
      if (countSuggestions) countSuggestions.textContent = String(data?.counts?.newsSuggestions || 0);
      if (countNotifications) countNotifications.textContent = String(data?.counts?.notifications || 0);
      if (countContacts) countContacts.textContent = String(data?.counts?.contacts || 0);

      if (suggestionsList) {
        suggestionsList.innerHTML = (data.latestSuggestions || [])
          .map((item) => `<article class="panel"><h3>${escapeHtml(item.title || 'Sugestão')}</h3><p>${escapeHtml(item.summary || '')}</p></article>`)
          .join('');

        if (!data.latestSuggestions?.length) {
          suggestionsList.innerHTML = '<article class="panel"><p class="small-note">Sem sugestões pendentes no momento.</p></article>';
        }
      }
    } catch (_) {
      if (feedback) feedback.textContent = 'Falha ao carregar visão geral do CMS.';
    }
  }

  async function renderArticles() {
    if (!list) return;
    try {
      const items = await fetchArticles();
      list.innerHTML = items
        .slice(0, 8)
        .map(
          (item) =>
            `<article class="panel"><p class="meta">${escapeHtml(item.category)} • ${escapeHtml(item.status)} • ${item.at ? new Date(item.at).toLocaleString() : ''}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.content)}</p><p class="small-note">Autor: ${escapeHtml(item.author || 'Equipe TSU')}</p></article>`
        )
        .join('');

      if (!items.length) {
        list.innerHTML = '<article class="panel"><p class="small-note">Nenhum artigo cadastrado ainda.</p></article>';
      }
    } catch (_) {
      list.innerHTML = '<article class="panel"><p class="small-note">Erro ao carregar artigos.</p></article>';
    }
  }

  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const payload = {
      title: titleInput?.value?.trim(),
      category: categoryInput?.value,
      status: statusInput?.value,
      content: contentInput?.value?.trim(),
      author: localStorage.getItem('tsu_last_user_email') || 'Equipe TSU',
    };

    if (!payload.title || !payload.category || !payload.content) return;

    const ok = await createArticle(payload);
    if (!ok) {
      if (feedback) feedback.textContent = 'Não foi possível salvar no backend.';
      return;
    }

    form.reset();
    if (feedback) feedback.textContent = 'Artigo salvo com sucesso.';
    renderArticles();
    renderOverview();
  });

  renderOverview();
  renderArticles();
})();
