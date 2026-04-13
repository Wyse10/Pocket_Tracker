(function initializeAppShell() {
  function getCurrentSection() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';

    if (path.includes('ai-insights')) {
      return 'insights';
    }

    if (path.includes('add-transaction')) {
      return 'add';
    }

    if (path.includes('dashboard') || path === '/') {
      return 'home';
    }

    return 'home';
  }

  function setActiveBottomNavItem() {
    const currentSection = getCurrentSection();
    const navItems = document.querySelectorAll('[data-bottom-nav-item]');

    navItems.forEach((item) => {
      const isActive = item.dataset.bottomNavItem === currentSection;
      item.classList.toggle('is-active', isActive);
      if (isActive) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  function initialize() {
    setActiveBottomNavItem();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setActiveBottomNavItem, { once: true });
    }
  }

  initialize();
})();
