const yearElement = document.getElementById('year');
if (yearElement) yearElement.textContent = String(new Date().getFullYear());

const STORAGE_KEY = 'tsu_analytics_events';

function ensureToastRoot() {
  let root = document.getElementById('toast-root');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'toast-root';
  root.className = 'toast-root';
  document.body.appendChild(root);
  return root;
}

function showToast(message, kind = 'info') {
  const root = ensureToastRoot();
  const item = document.createElement('div');
  item.className = `toast ${kind}`;
  item.textContent = message;
  root.appendChild(item);
  setTimeout(() => item.classList.add('show'), 10);
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 180);
  }, 2500);
}

function setupThemeToggle() {
  const saved = localStorage.getItem('tsu_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  const topbar = document.querySelector('.topbar');
  if (!topbar || topbar.querySelector('.theme-toggle')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button ghost theme-toggle';
  btn.setAttribute('data-track', 'theme_toggle');

  const syncLabel = () => {
    const mode = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.textContent = mode === 'light' ? 'Modo escuro' : 'Modo claro';
  };

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tsu_theme', next);
    syncLabel();
    showToast(`Tema alterado para ${next === 'dark' ? 'escuro' : 'claro'}.`, 'success');
  });

  syncLabel();
  topbar.appendChild(btn);
}

function setupMenuToggle() {
  const topbar = document.querySelector('.topbar');
  const menu = document.querySelector('.menu-links');
  if (!topbar || !menu || topbar.querySelector('.menu-toggle')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button ghost menu-toggle';
  btn.textContent = 'Menu';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('data-track', 'menu_toggle');

  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  topbar.insertBefore(btn, menu);
}

async function persistEvent(event) {
  const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  current.push(event);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-500)));

  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (_) {
    // backend opcional
  }
}

function pushEvent(type, detail = '') {
  const event = {
    at: new Date().toISOString(),
    type,
    page: location.pathname.split('/').pop() || 'index.html',
    detail,
  };
  persistEvent(event);
}

setupThemeToggle();
setupMenuToggle();
pushEvent('page_view', document.title);

document.addEventListener('click', (ev) => {
  const target = ev.target.closest('[data-track]');
  if (!target) return;
  pushEvent('click', target.getAttribute('data-track') || 'click');
});

document.querySelectorAll('.share-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const title = btn.dataset.title || document.title;
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        pushEvent('share', title);
      } catch (_) {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copiado para compartilhamento.', 'success');
      pushEvent('share_copy_link', title);
    } catch (_) {
      showToast('Não foi possível copiar o link.', 'error');
      pushEvent('share_failed', title);
    }
  });
});
