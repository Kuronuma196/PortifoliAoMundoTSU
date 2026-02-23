(function () {
  function track(detail) {
    try {
      document.querySelector(`[data-track="${detail}"]`)?.click();
    } catch (_) {}
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function apiPost(path, payload) {
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  async function hydrateHomeStats() {
    const contactsEl = document.getElementById('home-count-contacts');
    if (!contactsEl) return;

    const ids = {
      contacts: contactsEl,
      newsSuggestions: document.getElementById('home-count-news'),
      roleRequests: document.getElementById('home-count-roles'),
      analyticsEvents: document.getElementById('home-count-events'),
      notifications: document.getElementById('home-count-notifications'),
      cmsArticles: document.getElementById('home-count-articles'),
      creationJobs: document.getElementById('home-count-creations'),
    };

    try {
      const r = await fetch('/api/dashboard');
      if (!r.ok) return;
      const data = await r.json();
      Object.entries(ids).forEach(([key, node]) => {
        if (!node) return;
        node.textContent = String(data?.counts?.[key] || 0);
      });
    } catch (_) {}
  }

  const projectFilter = document.getElementById('project-filter');
  const projectCards = Array.from(document.querySelectorAll('.project-item'));
  if (projectFilter && projectCards.length) {
    projectFilter.addEventListener('change', () => {
      const value = projectFilter.value;
      projectCards.forEach((card) => {
        const category = card.getAttribute('data-category');
        card.style.display = value === 'all' || value === category ? '' : 'none';
      });
      track('project_filter_change');
    });
  }

  const galleryTabs = document.querySelectorAll('[data-gallery-tab]');
  const gallerySections = document.querySelectorAll('[data-gallery-section]');
  if (galleryTabs.length && gallerySections.length) {
    galleryTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-gallery-tab');
        galleryTabs.forEach((t) => t.classList.remove('active-chip'));
        tab.classList.add('active-chip');
        gallerySections.forEach((sec) => {
          sec.style.display = sec.getAttribute('data-gallery-section') === target ? '' : 'none';
        });
        track('gallery_tab_change');
      });
    });
  }

  const newsForm = document.getElementById('news-form');
  const newsList = document.getElementById('community-news-list');
  const NEWS_KEY = 'tsu_news_suggestions';

  async function readNews() {
    try {
      const r = await fetch('/api/news-suggestions');
      if (r.ok) return await r.json();
    } catch (_) {}
    return JSON.parse(localStorage.getItem(NEWS_KEY) || '[]');
  }

  async function renderNewsSuggestions() {
    if (!newsList) return;
    const items = await readNews();
    newsList.innerHTML = items
      .slice(-8)
      .reverse()
      .map((n) => `<article class="panel"><p class="meta">Comunidade</p><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.summary)}</p></article>`)
      .join('');
  }

  if (newsForm) {
    renderNewsSuggestions();
    newsForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = document.getElementById('news-title')?.value?.trim();
      const summary = document.getElementById('news-summary')?.value?.trim();
      if (!title || !summary) return;
      const payload = { title, summary };
      const ok = await apiPost('/api/news-suggestions', payload);
      if (!ok) {
        const items = JSON.parse(localStorage.getItem(NEWS_KEY) || '[]');
        items.push({ ...payload, at: new Date().toISOString() });
        localStorage.setItem(NEWS_KEY, JSON.stringify(items.slice(-30)));
      }
      newsForm.reset();
      renderNewsSuggestions();
      track('news_suggestion_submit');
    });
  }

  const contactForm = document.getElementById('contact-form');
  const contactFeedback = document.getElementById('contact-feedback');
  if (contactForm) {
    contactForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        name: document.getElementById('contact-name')?.value?.trim(),
        email: document.getElementById('contact-email')?.value?.trim(),
        type: document.getElementById('contact-type')?.value,
        message: document.getElementById('contact-message')?.value?.trim(),
      };
      if (!payload.name || !payload.email || !payload.message) return;
      const ok = await apiPost('/api/contact', payload);
      if (!ok) {
        const list = JSON.parse(localStorage.getItem('tsu_contact_messages') || '[]');
        list.push({ ...payload, at: new Date().toISOString() });
        localStorage.setItem('tsu_contact_messages', JSON.stringify(list.slice(-100)));
      }
      contactForm.reset();
      if (contactFeedback) contactFeedback.textContent = 'Mensagem registrada com sucesso.';
      track('contact_form_submit');
    });
  }

  hydrateHomeStats();
})();
