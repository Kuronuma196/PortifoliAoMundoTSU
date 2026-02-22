(function () {
  const key = 'tsu_api_endpoints';
  const defaultEndpoints = window.TSU_API_ENDPOINTS || {};

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
    } catch (err) {
      if (feedbackEl) feedbackEl.textContent = `Falha na geração: ${err.message}`;
      if (resultEl) resultEl.textContent = JSON.stringify({
        error: String(err.message),
        hint: 'Configure endpoints válidos na seção de configuração.',
      }, null, 2);
    }
  });

  fillConfig();
})();
