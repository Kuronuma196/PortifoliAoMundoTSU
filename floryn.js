(function () {
  const statusEl = document.getElementById('floryn-user-status');
  const chatLog = document.getElementById('chat-log');
  const form = document.getElementById('floryn-form');
  const input = document.getElementById('floryn-input');
  const enableBtn = document.getElementById('enable-notifications');
  const sendNotifBtn = document.getElementById('send-update-notification');
  const notificationsFeed = document.getElementById('notifications-feed');
  const chatKey = 'tsu_floryn_chat';

  const role = localStorage.getItem('tsu_role') || 'visitante';
  const authEmail = (localStorage.getItem('tsu_last_user_email') || '').trim();
  const logged = Boolean(authEmail);
  const audience = logged ? 'logged' : 'public';

  if (statusEl) {
    statusEl.textContent = logged
      ? `Usuário logado (${authEmail}) • Perfil: ${role}`
      : `Usuário não logado • Perfil local: ${role}`;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readChat() {
    return JSON.parse(localStorage.getItem(chatKey) || '[]');
  }

  function saveChat(messages) {
    localStorage.setItem(chatKey, JSON.stringify(messages.slice(-80)));
  }

  function addMessage(author, text) {
    const msgs = readChat();
    msgs.push({ at: new Date().toISOString(), author, text });
    saveChat(msgs);
    renderChat();
  }

  function florynReply(userText) {
    const t = userText.toLowerCase();
    if (t.includes('serviço') || t.includes('contratar')) {
      return 'Perfeito! Para contratação, envie escopo, prazo e objetivo no formulário de contato.';
    }
    if (t.includes('vaga') || t.includes('seletivo')) {
      return 'No momento não há processos seletivos abertos. Posso registrar seu interesse no perfil Candidato.';
    }
    if (t.includes('notícia') || t.includes('atualização')) {
      return 'Você pode acompanhar atualizações na página Notícias e ativar notificações aqui.';
    }
    return 'Entendi. Posso ajudar com serviços, processos seletivos, notícias e direcionamento para as áreas do portal.';
  }

  function renderChat() {
    if (!chatLog) return;
    const msgs = readChat();
    chatLog.innerHTML = msgs
      .map((m) => `<div class="chat-msg ${m.author === 'floryn' ? 'floryn' : 'user'}"><strong>${escapeHtml(m.author)}:</strong> ${escapeHtml(m.text)}</div>`)
      .join('');
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function postNotification(payload) {
    try {
      const r = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  async function loadNotifications() {
    if (!notificationsFeed) return;

    try {
      const r = await fetch(`/api/notifications?audience=${encodeURIComponent(audience)}`);
      if (!r.ok) throw new Error('request_failed');
      const items = await r.json();

      notificationsFeed.innerHTML = (items || [])
        .slice(0, 6)
        .map((item) => {
          const source = item.source || 'portal';
          const when = item.at ? new Date(item.at).toLocaleString() : 'agora';
          return `<article class="panel"><p class="meta">${escapeHtml(source)} • ${escapeHtml(when)}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p></article>`;
        })
        .join('');

      if (!items?.length) {
        notificationsFeed.innerHTML = '<article class="panel"><p class="small-note">Ainda não há notificações publicadas.</p></article>';
      }
    } catch (_) {
      notificationsFeed.innerHTML = '<article class="panel"><p class="small-note">Não foi possível carregar notificações do backend.</p></article>';
    }
  }

  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = input?.value?.trim();
    if (!text) return;
    addMessage('você', text);
    addMessage('floryn', florynReply(text));
    form.reset();
  });

  enableBtn?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      addMessage('floryn', 'Seu navegador não suporta notificações.');
      return;
    }
    const perm = await Notification.requestPermission();
    addMessage('floryn', perm === 'granted' ? 'Notificações ativadas.' : 'Permissão de notificações não concedida.');
  });

  sendNotifBtn?.addEventListener('click', async () => {
    const message = logged
      ? 'Atualização TSU para usuários logados: confira novidades e painel operacional.'
      : 'Atualização TSU pública: confira as notícias e acompanhe os projetos.';

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Floryn • TSU', { body: message });
    }

    const ok = await postNotification({
      title: 'Atualização enviada pela Floryn',
      message,
      audience,
      source: 'floryn',
    });

    addMessage('floryn', ok ? 'Atualização publicada no centro de notificações.' : message);
    loadNotifications();
  });

  if (readChat().length === 0) {
    addMessage('floryn', 'Olá! Sou a Floryn, atendente virtual do TSU. Como posso ajudar hoje?');
  } else {
    renderChat();
  }

  loadNotifications();
  setInterval(loadNotifications, 20000);
})();
