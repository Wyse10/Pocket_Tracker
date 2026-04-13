const authForm = document.getElementById('auth-form');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const nameField = document.getElementById('name-field');
const confirmPasswordField = document.getElementById('confirm-password-field');
const fullNameInput = document.getElementById('full-name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const togglePasswordButton = document.getElementById('toggle-password');
const toggleConfirmPasswordButton = document.getElementById('toggle-confirm-password');
const fullNameError = document.getElementById('full-name-error');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const confirmPasswordHint = document.getElementById('confirm-password-hint');
const confirmPasswordError = document.getElementById('confirm-password-error');
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
  confirmPasswordField.classList.toggle('hidden', !isSignup);
  fullNameInput.required = isSignup;
  confirmPasswordInput.required = isSignup;
  fullNameInput.autocomplete = isSignup ? 'name' : 'off';
  confirmPasswordInput.autocomplete = isSignup ? 'new-password' : 'off';

  passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
  if (!isSignup) {
    confirmPasswordInput.value = '';
  }
  setPasswordVisibility(passwordInput, togglePasswordButton, false);
  setPasswordVisibility(confirmPasswordInput, toggleConfirmPasswordButton, false);
  updateConfirmPasswordHint();
  submitButton.textContent = isSignup ? 'Create Account' : 'Sign In';
  clearAllFieldErrors();
  authMessage.textContent = '';
  authMessage.classList.remove('error');
}

function showMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.classList.toggle('error', isError);
}

function clearFieldError(inputElement, errorElement) {
  inputElement?.classList.remove('input-error');
  if (errorElement) {
    errorElement.textContent = '';
  }
}

function showFieldError(inputElement, errorElement, message) {
  if (!message) {
    return;
  }

  inputElement?.classList.add('input-error');
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearAllFieldErrors() {
  clearFieldError(fullNameInput, fullNameError);
  clearFieldError(emailInput, emailError);
  clearFieldError(passwordInput, passwordError);
  clearFieldError(confirmPasswordInput, confirmPasswordError);
}

function setConfirmPasswordHint(text, state = '') {
  if (!confirmPasswordHint) {
    return;
  }

  confirmPasswordHint.textContent = text;
  confirmPasswordHint.classList.remove('match', 'mismatch');
  if (state) {
    confirmPasswordHint.classList.add(state);
  }
}

function updateConfirmPasswordHint() {
  if (mode !== 'signup') {
    setConfirmPasswordHint('');
    return;
  }

  const password = String(passwordInput.value || '');
  const confirmPassword = String(confirmPasswordInput.value || '');

  if (!confirmPassword) {
    setConfirmPasswordHint('');
    return;
  }

  if (!password) {
    setConfirmPasswordHint('Enter a password first.', 'mismatch');
    return;
  }

  if (password === confirmPassword) {
    setConfirmPasswordHint('Passwords match.', 'match');
    return;
  }

  setConfirmPasswordHint('Passwords do not match yet.', 'mismatch');
}

function setPasswordVisibility(inputElement, toggleButton, shouldShow) {
  if (!inputElement || !toggleButton) {
    return;
  }

  inputElement.type = shouldShow ? 'text' : 'password';
  toggleButton.textContent = shouldShow ? 'Hide' : 'Show';
  toggleButton.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
}

function attachVisibilityToggle(toggleButton, inputElement) {
  toggleButton?.addEventListener('click', () => {
    const shouldShow = inputElement.type === 'password';
    setPasswordVisibility(inputElement, toggleButton, shouldShow);
  });
}

function userFriendlyFieldMessage(field, type, fallbackMessage) {
  const fallback = typeof fallbackMessage === 'string' && fallbackMessage.trim()
    ? fallbackMessage
    : 'Please check this field and try again.';

  if (field === 'password') {
    if (type === 'string_too_short') {
      return 'Password is too short. Use at least 8 characters.';
    }
    return 'Please enter a valid password.';
  }

  if (field === 'email') {
    if (type === 'string_too_short') {
      return 'Please enter a valid email address.';
    }
    return 'Please check your email address.';
  }

  if (field === 'full_name') {
    if (type === 'string_too_short') {
      return 'Full name is too short. Enter at least 2 characters.';
    }
    return 'Please enter your full name.';
  }

  return fallback;
}

function parseAuthError(error) {
  const detail = error?.payload?.detail;
  const fieldErrors = { full_name: '', email: '', password: '' };

  if (Array.isArray(detail) && detail.length > 0) {
    for (const issue of detail) {
      const path = Array.isArray(issue?.loc) ? issue.loc : [];
      const field = String(path[path.length - 1] || '').trim();

      if (!field || !(field in fieldErrors) || fieldErrors[field]) {
        continue;
      }

      fieldErrors[field] = userFriendlyFieldMessage(field, issue?.type, issue?.msg);
    }

    const firstFieldMessage = fieldErrors.full_name || fieldErrors.email || fieldErrors.password;
    return {
      fieldErrors,
      formMessage: firstFieldMessage || 'Please correct the highlighted fields and try again.',
    };
  }

  return {
    fieldErrors,
    formMessage: error?.message || 'Authentication failed.',
  };
}

function applyFieldErrors(fieldErrors) {
  showFieldError(fullNameInput, fullNameError, fieldErrors.full_name);
  showFieldError(emailInput, emailError, fieldErrors.email);
  showFieldError(passwordInput, passwordError, fieldErrors.password);
}

async function submitAuth(event) {
  event.preventDefault();
  clearAllFieldErrors();

  const email = String(emailInput.value || '').trim();
  const password = String(passwordInput.value || '');
  const confirmPassword = String(confirmPasswordInput.value || '');
  const fullName = String(fullNameInput.value || '').trim();

  if (!email || !password || (mode === 'signup' && (!fullName || !confirmPassword))) {
    if (!email) {
      showFieldError(emailInput, emailError, 'Email is required.');
    }
    if (!password) {
      showFieldError(passwordInput, passwordError, 'Password is required.');
    }
    if (mode === 'signup' && !fullName) {
      showFieldError(fullNameInput, fullNameError, 'Full name is required.');
    }
    if (mode === 'signup' && !confirmPassword) {
      showFieldError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password.');
    }
    showMessage('Please complete all required fields.', true);
    return;
  }

  if (mode === 'signup' && password !== confirmPassword) {
    showFieldError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match.');
    showMessage('Please make sure both passwords match.', true);
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
    const parsed = parseAuthError(error);
    applyFieldErrors(parsed.fieldErrors);
    showMessage(parsed.formMessage, true);
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
fullNameInput?.addEventListener('input', () => clearFieldError(fullNameInput, fullNameError));
emailInput?.addEventListener('input', () => clearFieldError(emailInput, emailError));
passwordInput?.addEventListener('input', () => {
  clearFieldError(passwordInput, passwordError);
  updateConfirmPasswordHint();
});
confirmPasswordInput?.addEventListener('input', () => {
  clearFieldError(confirmPasswordInput, confirmPasswordError);
  updateConfirmPasswordHint();
});
attachVisibilityToggle(togglePasswordButton, passwordInput);
attachVisibilityToggle(toggleConfirmPasswordButton, confirmPasswordInput);

setMode('login');
redirectIfAuthenticated();
