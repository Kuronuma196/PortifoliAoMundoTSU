(function () {
  const key = 'tsu_api_endpoints';
  const defaultEndpoints = {
    image: '/api/creation/generate',
    video: '/api/creation/generate',
    audio: '/api/creation/generate',
    text: '/api/creation/generate',
    ...(window.TSU_API_ENDPOINTS || {}),
  };

  const fields = {
    image: document.getElementById('api-image'),
    video: document.getElementById('api-video'),
    audio: document.getElementById('api-audio'),
    text: document.getElementById('api-text'),
  };

  const saveBtn = document.getElementById('save-api-config');
  const form = document.getElementById('generation-form');
  const typeEl = document.getElementById('generation-type');
  const promptEl = document.getElementById('generation-prompt');
  const feedbackEl = document.getElementById('generation-feedback');
  const resultEl = document.getElementById('generation-result');
  const historyEl = document.getElementById('generation-history');

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readConfig() {
    return { ...defaultEndpoints, ...JSON.parse(localStorage.getItem(key) || '{}') };
  }

  function fillConfig() {
    const c = readConfig();
    if (fields.image) fields.image.value = c.image || '';
    if (fields.video) fields.video.value = c.video || '';
    if (fields.audio) fields.audio.value = c.audio || '';
    if (fields.text) fields.text.value = c.text || '';
  }

  function readHistory() {
    return JSON.parse(localStorage.getItem('tsu_generation_history') || '[]');
  }

  function saveHistory(entry) {
    const history = readHistory();
    history.push(entry);
    localStorage.setItem('tsu_generation_history', JSON.stringify(history.slice(-20)));
  }

  function renderHistory() {
    if (!historyEl) return;
    const items = readHistory().slice(-10).reverse();
    historyEl.innerHTML = items
      .map((item) => {
        const at = item.at ? new Date(item.at).toLocaleString() : 'agora';
        return `<article class="panel"><p class="meta">${escapeHtml(item.type)} • ${escapeHtml(at)}</p><h3>${escapeHtml(item.prompt)}</h3><p>${escapeHtml(item.preview)}</p></article>`;
      })
      .join('');

    if (!items.length) {
      historyEl.innerHTML = '<article class="panel"><p class="small-note">Nenhuma geração realizada ainda.</p></article>';
    }
  }

  saveBtn?.addEventListener('click', () => {
    const config = {
      image: fields.image?.value?.trim() || '',
      video: fields.video?.value?.trim() || '',
      audio: fields.audio?.value?.trim() || '',
      text: fields.text?.value?.trim() || '',
    };
    localStorage.setItem(key, JSON.stringify(config));
    if (feedbackEl) feedbackEl.textContent = 'Endpoints salvos com sucesso.';
  });

  async function callApi(type, prompt) {
    const config = readConfig();
    const url = config[type];
    if (!url) throw new Error(`Endpoint de ${type} não configurado.`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, type }),
    });

    if (!resp.ok) throw new Error(`Erro HTTP ${resp.status}`);
    return resp.json();
  }

  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const type = typeEl?.value || 'text';
    const prompt = promptEl?.value?.trim() || '';
    if (!prompt) return;
    if (feedbackEl) feedbackEl.textContent = 'Gerando conteúdo...';
    if (resultEl) resultEl.textContent = 'Aguardando resposta da API...';

    try {
      const data = await callApi(type, prompt);
      if (feedbackEl) feedbackEl.textContent = 'Conteúdo gerado com sucesso.';
      if (resultEl) resultEl.textContent = JSON.stringify(data, null, 2);

      const preview = data?.output?.excerpt || data?.output?.text || data?.output?.url || 'Resultado gerado com sucesso';
      saveHistory({ at: new Date().toISOString(), type, prompt, preview: String(preview).slice(0, 160) });
      renderHistory();
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `Falha na geração: ${err.message}`;
      if (resultEl) resultEl.textContent = JSON.stringify({ error: err.message }, null, 2);
    }
  });

  fillConfig();
  renderHistory();
})();
