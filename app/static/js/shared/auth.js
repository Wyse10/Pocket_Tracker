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

  function attachLogoutHandler() {
    const logoutButton = document.getElementById('logout-button');
    if (!logoutButton) {
      return;
    }

    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      const originalText = logoutButton.textContent;
      logoutButton.textContent = 'Signing out...';

      try {
        await window.apiClient.postJson('/auth/logout', {}, 'Failed to sign out.');
      } catch (error) {
        // Continue with redirect even when backend session cleanup fails.
      }

      logoutButton.disabled = false;
      logoutButton.textContent = originalText;
      window.location.assign('/login');
    });
  }



  function renderUserGreeting(user) {
    const greetingElement = document.getElementById('user-greeting');
    if (!greetingElement || !user) {
      return;
    }

    const name = String(user.full_name || '').trim();
    greetingElement.textContent = name ? `Signed in as ${name}` : `Signed in as ${user.email}`;
  }

  window.authGuardReady = (async () => {
    const user = await getCurrentUser();
    if (!user) {
      redirectToLogin();
      return null;
    }

    renderUserGreeting(user);
    attachLogoutHandler();
    return user;
  })();
})();
