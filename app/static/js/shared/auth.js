(function initializeAuthGuard() {
  async function getCurrentUser() {
    try {
      const response = await fetch('/auth/me', { credentials: 'same-origin' });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function redirectToLogin() {
    const currentPath = `${window.location.pathname}${window.location.search || ''}`;
    const loginUrl = new URL('/login', window.location.origin);
    loginUrl.searchParams.set('next', currentPath);
    window.location.assign(loginUrl.toString());
  }

  function renderUserGreeting(user) {
    const greetingElement = document.getElementById('user-greeting');
    if (!greetingElement || !user) {
      return;
    }

    const name = String(user.full_name || '').trim();
    greetingElement.textContent = name ? `Welcome back, ${name}.` : `Welcome back, ${user.email}.`;
  }

  window.authGuardReady = (async () => {
    const user = await getCurrentUser();
    if (!user) {
      redirectToLogin();
      return null;
    }

    window.authCurrentUser = user;
    renderUserGreeting(user);
    return user;
  })();
})();
