const authForm = document.getElementById('auth-form');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const nameField = document.getElementById('name-field');
const fullNameInput = document.getElementById('full-name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('submit-auth');
const authMessage = document.getElementById('auth-message');

let mode = 'login';

function nextRoute() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && next.startsWith('/')) {
    return next;
  }
  return '/add-transaction';
}

function setMode(newMode) {
  mode = newMode;
  const isSignup = mode === 'signup';

  tabLogin.classList.toggle('active', !isSignup);
  tabSignup.classList.toggle('active', isSignup);

  nameField.classList.toggle('hidden', !isSignup);
  fullNameInput.required = isSignup;
  fullNameInput.autocomplete = isSignup ? 'name' : 'off';

  passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
  submitButton.textContent = isSignup ? 'Create Account' : 'Sign In';
  authMessage.textContent = '';
  authMessage.classList.remove('error');
}

function showMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.classList.toggle('error', isError);
}

async function submitAuth(event) {
  event.preventDefault();

  const email = String(emailInput.value || '').trim();
  const password = String(passwordInput.value || '');
  const fullName = String(fullNameInput.value || '').trim();

  if (!email || !password || (mode === 'signup' && !fullName)) {
    showMessage('Please complete all required fields.', true);
    return;
  }

  submitButton.disabled = true;
  showMessage(mode === 'signup' ? 'Creating account...' : 'Signing in...');

  try {
    if (mode === 'signup') {
      await window.apiClient.postJson(
        '/auth/signup',
        { full_name: fullName, email, password },
        'Failed to create account.'
      );
    } else {
      await window.apiClient.postJson('/auth/login', { email, password }, 'Failed to sign in.');
    }

    window.location.assign(nextRoute());
  } catch (error) {
    showMessage(error?.message || 'Authentication failed.', true);
    submitButton.disabled = false;
  }
}

async function redirectIfAuthenticated() {
  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (response.ok) {
      window.location.assign(nextRoute());
    }
  } catch (error) {
    // Ignore auth failures and keep login page visible.
  }
}

tabLogin?.addEventListener('click', () => setMode('login'));
tabSignup?.addEventListener('click', () => setMode('signup'));
authForm?.addEventListener('submit', submitAuth);

setMode('login');
redirectIfAuthenticated();
