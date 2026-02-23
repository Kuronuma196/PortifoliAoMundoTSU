const yearElement = document.getElementById('year');
if (yearElement) yearElement.textContent = String(new Date().getFullYear());

const STORAGE_KEY = 'tsu_analytics_events';

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
      alert('Link copiado para compartilhamento.');
      pushEvent('share_copy_link', title);
    } catch (_) {
      pushEvent('share_failed', title);
    }
  });
});
