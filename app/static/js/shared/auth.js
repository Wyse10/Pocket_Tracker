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

  function attachClaimLegacyHandler() {
    const claimButton = document.getElementById('claim-legacy-button');
    const claimStatus = document.getElementById('claim-legacy-status');

    if (!claimButton) {
      return;
    }

    claimButton.addEventListener('click', async () => {
      claimButton.disabled = true;
      const previousText = claimButton.textContent;
      claimButton.textContent = 'Claiming...';
      if (claimStatus) {
        claimStatus.textContent = 'Claiming legacy transactions...';
      }

      try {
        const result = await window.apiClient.postJson(
          '/auth/claim-legacy-transactions',
          {},
          'Failed to claim legacy transactions.'
        );
        const migratedCount = Number(result?.migrated_count || 0);
        if (claimStatus) {
          claimStatus.textContent = migratedCount
            ? `Successfully migrated ${migratedCount} legacy transaction(s).`
            : 'No legacy transactions were found to migrate.';
        }
      } catch (error) {
        if (claimStatus) {
          claimStatus.textContent = error?.message || 'Failed to claim legacy transactions.';
        }
      } finally {
        claimButton.disabled = false;
        claimButton.textContent = previousText;
      }
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
    attachClaimLegacyHandler();
    return user;
  })();
})();
