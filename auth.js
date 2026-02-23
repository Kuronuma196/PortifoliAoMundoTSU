import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';

const firebaseConfig = window.TSU_FIREBASE_CONFIG || {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_APP_ID',
};

const loginBtn = document.getElementById('google-login');
const logoutBtn = document.getElementById('logout');
const statusEl = document.getElementById('auth-status');
const roleSelect = document.getElementById('role-select');
const roleFeedback = document.getElementById('role-feedback');
const prefNews = document.getElementById('pref-news');
const prefSelection = document.getElementById('pref-selection');
const savePrefsBtn = document.getElementById('save-prefs');
const requestForm = document.getElementById('role-request-form');
const requestTitle = document.getElementById('request-title');
const requestDescription = document.getElementById('request-description');
const requestIntro = document.getElementById('request-intro');
const requestFeedback = document.getElementById('request-feedback');

const EMPLOYEE_WHITELIST = ['kuronumadeal@gmail.com'];
const configReady = !String(firebaseConfig.apiKey || '').startsWith('YOUR_');
const REQUESTS_KEY = 'tsu_role_requests';

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function loadPreferences() {
  const prefs = JSON.parse(localStorage.getItem('tsu_prefs') || '{}');
  if (prefNews) prefNews.checked = Boolean(prefs.news);
  if (prefSelection) prefSelection.checked = Boolean(prefs.selection);
}

function savePreferences() {
  const prefs = {
    news: Boolean(prefNews?.checked),
    selection: Boolean(prefSelection?.checked),
  };
  localStorage.setItem('tsu_prefs', JSON.stringify(prefs));
  if (roleFeedback) roleFeedback.textContent = 'Preferências salvas com sucesso.';
}

function roleIntro(role) {
  const intros = {
    candidato: 'Perfil Candidato: atualmente sem vagas abertas; ainda assim você pode registrar interesse.',
    cliente: 'Perfil Cliente: descreva demanda, escopo e objetivo do projeto desejado.',
    avaliador: 'Perfil Avaliador: envie crítica, análise e sugestões de melhoria com contexto.',
    funcionario: 'Perfil Funcionário: use para registro interno e atualização operacional.',
    criador: 'Perfil Criador: envie proposta de personagem, história, nome, logo ou identidade visual.',
  };
  return intros[role] || 'Selecione um perfil para habilitar este formulário.';
}

function updateRoleMessage(role, userEmail) {
  if (!roleFeedback) return;
  if (!role) {
    roleFeedback.textContent = 'Selecione um tipo de usuário para ativar seu perfil.';
    if (requestIntro) requestIntro.textContent = roleIntro('');
    return;
  }

  if (role === 'funcionario' && !EMPLOYEE_WHITELIST.includes((userEmail || '').toLowerCase())) {
    roleFeedback.textContent = 'Seu e-mail Google não está autorizado como Funcionário. Use outro perfil ou solicite cadastro.';
    if (requestIntro) requestIntro.textContent = roleIntro(role);
    return;
  }

  const messages = {
    candidato: 'Perfil Candidato ativo. Avisos de vagas serão habilitados quando houver abertura.',
    cliente: 'Perfil Cliente ativo. Você pode registrar briefing e contratação de serviços.',
    avaliador: 'Perfil Avaliador ativo. Comentários e sugestões serão associados ao seu perfil.',
    funcionario: 'Perfil Funcionário ativo e validado na lista interna.',
    criador: 'Perfil Criador ativo. Propostas ficam sujeitas a curadoria e repaginagem editorial.',
  };

  roleFeedback.textContent = messages[role] || 'Perfil selecionado.';
  if (requestIntro) requestIntro.textContent = roleIntro(role);
}

async function postRoleRequest(payload) {
  try {
    const r = await fetch('/api/role-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch (_) {
    return false;
  }
}

function saveRoleRequest(auth) {
  if (!requestForm || !roleSelect) return;

  requestForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const role = roleSelect.value;
    const title = requestTitle?.value?.trim();
    const description = requestDescription?.value?.trim();
    const email = auth.currentUser?.email || '';

    if (!role || !title || !description) return;
    if (role === 'funcionario' && !EMPLOYEE_WHITELIST.includes(email.toLowerCase())) {
      if (requestFeedback) requestFeedback.textContent = 'Solicitação bloqueada: e-mail não autorizado para perfil Funcionário.';
      return;
    }

    const payload = {
      role,
      title,
      description,
      email,
      user: auth.currentUser?.displayName || email || 'anônimo',
    };

    postRoleRequest(payload).then((ok) => {
      if (!ok) {
        const records = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
        records.push({ ...payload, at: new Date().toISOString() });
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(records.slice(-200)));
      }
      requestForm.reset();
      if (requestFeedback) requestFeedback.textContent = 'Solicitação registrada com sucesso.';
    });
  });
}

if (!configReady) {
  setStatus('Configuração Firebase pendente. Defina window.TSU_FIREBASE_CONFIG para ativar login Google.');
  if (loginBtn) loginBtn.disabled = true;
  if (logoutBtn) logoutBtn.disabled = true;
  if (requestIntro) requestIntro.textContent = roleIntro('');
  updateRoleMessage('', '');
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  loadPreferences();

  if (savePrefsBtn) savePrefsBtn.addEventListener('click', savePreferences);

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (_) {
        setStatus('Falha no login Google. Verifique configuração Firebase e domínio autorizado.');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      localStorage.removeItem('tsu_role');
      localStorage.removeItem('tsu_last_user_email');
      if (roleSelect) roleSelect.value = '';
      updateRoleMessage('', '');
    });
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', () => {
      const role = roleSelect.value;
      localStorage.setItem('tsu_role', role);
      updateRoleMessage(role, auth.currentUser?.email || '');
    });
  }

  saveRoleRequest(auth);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setStatus('Nenhum usuário autenticado.');
      return;
    }

    setStatus(`Conectado: ${user.displayName || user.email} (${user.email})`);
    localStorage.setItem('tsu_last_user_email', user.email || '');
    const savedRole = localStorage.getItem('tsu_role') || '';
    if (roleSelect && savedRole) roleSelect.value = savedRole;
    updateRoleMessage(savedRole, user.email || '');
  });
}
