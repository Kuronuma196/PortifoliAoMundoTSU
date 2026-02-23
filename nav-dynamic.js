(function () {
  const pages = [
    ['index.html', 'Início'],
    ['personagens.html', 'Personagens'],
    ['projetos.html', 'Projetos'],
    ['cronologia.html', 'Cronologia'],
    ['galeria.html', 'Galeria'],
    ['noticias.html', 'Notícias'],
    ['analises.html', 'Análises'],
    ['acesso.html', 'Acesso'],
    ['painel.html', 'Painel'],
    ['criacao.html', 'Criação'],
    ['floryn.html', 'Floryn IA'],
    ['sobre.html', 'Sobre'],
    ['contato.html', 'Contato'],
  ];

  const current = location.pathname.split('/').pop() || 'index.html';

  const launcherBtn = document.createElement('button');
  launcherBtn.className = 'page-launcher-btn';
  launcherBtn.type = 'button';
  launcherBtn.textContent = 'Explorar páginas';
  launcherBtn.setAttribute('data-track', 'open_page_launcher');

  const overlay = document.createElement('div');
  overlay.className = 'page-launcher-overlay';
  overlay.innerHTML = `
    <div class="page-launcher-modal" role="dialog" aria-modal="true" aria-label="Navegação entre páginas">
      <div class="page-launcher-head">
        <h3>Navegação rápida</h3>
        <button type="button" class="button ghost" id="launcher-close">Fechar</button>
      </div>
      <input id="launcher-search" class="role-select" placeholder="Buscar página..." />
      <div id="launcher-list" class="launcher-list"></div>
    </div>
  `;

  function buildList(filter = '') {
    const list = overlay.querySelector('#launcher-list');
    if (!list) return;
    const term = filter.toLowerCase().trim();

    list.innerHTML = pages
      .filter(([, label]) => label.toLowerCase().includes(term))
      .map(([href, label]) => {
        const active = href === current;
        return `<a class="launcher-item ${active ? 'active' : ''}" href="${href}">${label}${active ? ' • página atual' : ''}</a>`;
      })
      .join('');
  }

  function open() {
    overlay.style.display = 'grid';
    buildList();
    const input = overlay.querySelector('#launcher-search');
    if (input) input.focus();
  }

  function close() {
    overlay.style.display = 'none';
  }

  launcherBtn.addEventListener('click', open);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });

  overlay.querySelector('#launcher-close')?.addEventListener('click', close);
  overlay.querySelector('#launcher-search')?.addEventListener('input', (ev) => {
    buildList(ev.target.value || '');
  });

  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      open();
    }
    if (ev.key === 'Escape') close();
  });

  document.body.appendChild(launcherBtn);
  document.body.appendChild(overlay);
})();
