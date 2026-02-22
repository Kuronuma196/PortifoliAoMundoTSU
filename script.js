const yearElement = document.getElementById('year');
if (yearElement) yearElement.textContent = String(new Date().getFullYear());

const STORAGE_KEY = 'tsu_analytics_events';

function pushEvent(type, detail = '') {
  const event = {
    at: new Date().toISOString(),
    type,
    page: location.pathname.split('/').pop() || 'index.html',
    detail,
  };
  const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  current.push(event);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(-500)));
}

pushEvent('page_view', document.title);

document.addEventListener('click', (ev) => {
  const target = ev.target.closest('[data-track]');
  if (!target) return;
  const name = target.getAttribute('data-track') || 'click';
  pushEvent('click', name);
});

document.querySelectorAll('.share-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const title = btn.dataset.title || document.title;
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        pushEvent('share', title);
      } catch (_) {
        // ignored
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    alert('Link copiado para compartilhamento.');
    pushEvent('share_copy_link', title);
  });
});
