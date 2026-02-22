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

const EMPLOYEE_WHITELIST = ['kuronumadeal@gmail.com'];
const configReady = !String(firebaseConfig.apiKey || '').startsWith('YOUR_');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function updateRoleMessage(role, userEmail) {
  if (!roleFeedback) return;
  if (!role) {
    roleFeedback.textContent = 'Selecione um tipo de usuário para ativar seu perfil.';
    return;
  }
  if (role === 'funcionario' && !EMPLOYEE_WHITELIST.includes((userEmail || '').toLowerCase())) {
    roleFeedback.textContent = 'Seu e-mail Google não está autorizado como Funcionário. Use outro perfil ou solicite cadastro.';
    return;
  }

  const messages = {
    candidato: 'Perfil Candidato ativo. Notificações de vagas e processos seletivos serão habilitadas quando houver abertura.',
    cliente: 'Perfil Cliente ativo. Você pode enviar demanda para contratação de serviços e novos projetos.',
    avaliador: 'Perfil Avaliador ativo. Comentários, críticas e sugestões serão associados ao seu perfil.',
    funcionario: 'Perfil Funcionário ativo e validado na lista interna.',
    criador: 'Perfil Criador ativo. Envie proposta de personagem, história, logotipo ou identidade visual (sujeito a repaginagem).',
  };

  roleFeedback.textContent = messages[role] || 'Perfil selecionado.';
}

if (!configReady) {
  setStatus('Configuração Firebase pendente. Defina window.TSU_FIREBASE_CONFIG para ativar login Google.');
  if (loginBtn) loginBtn.disabled = true;
  if (logoutBtn) logoutBtn.disabled = true;
  updateRoleMessage('');
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      await signInWithPopup(auth, provider);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      localStorage.removeItem('tsu_role');
      if (roleSelect) roleSelect.value = '';
      updateRoleMessage('');
    });
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', () => {
      const role = roleSelect.value;
      localStorage.setItem('tsu_role', role);
      updateRoleMessage(role, auth.currentUser?.email || '');
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setStatus('Nenhum usuário autenticado.');
      return;
    }

    setStatus(`Conectado: ${user.displayName || user.email} (${user.email})`);
    const savedRole = localStorage.getItem('tsu_role') || '';
    if (roleSelect && savedRole) roleSelect.value = savedRole;
    updateRoleMessage(savedRole, user.email || '');
  });
}
