(function initializeProfileAvatar() {
  const STORAGE_KEY = 'pocket-tracker.profile-picture';
  const MAX_FILE_SIZE_BYTES = 1572864;
  const VALID_MIME_TYPES = new Set(['image/png', 'image/jpeg']);
  const VALID_EXTENSIONS = new Set(['png', 'jpg', 'jpeg']);
  const MENU_ACTION_TIMEOUT_MS = 150;

  let widgetState = null;

  function getWidgetHost() {
    return document.querySelector('.app-header__actions')
      || document.querySelector('.top-links-row')
      || document.querySelector('.top-links');
  }

  function getStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readStoredProfilePicture() {
    const storage = getStorage();
    if (!storage) {
      return null;
    }

    try {
      const rawValue = storage.getItem(STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      const parsed = JSON.parse(rawValue);
      if (typeof parsed?.dataUrl !== 'string' || !parsed.dataUrl.startsWith('data:image/')) {
        return null;
      }

      return parsed;
    } catch (error) {
      return null;
    }
  }

  function persistProfilePicture(payload) {
    const storage = getStorage();
    if (!storage) {
      return false;
    }

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearProfilePicture() {
    const storage = getStorage();
    if (!storage) {
      return false;
    }

    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getInitials(user) {
    const fullName = String(user?.full_name || '').trim();
    if (fullName) {
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      if (nameParts.length === 1) {
        return nameParts[0].slice(0, 2).toUpperCase();
      }

      return `${nameParts[0][0] || ''}${nameParts[nameParts.length - 1][0] || ''}`.toUpperCase();
    }

    const email = String(user?.email || '').trim();
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }

    return 'PT';
  }

  function fileExtension(fileName) {
    const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function validateFile(file) {
    if (!file) {
      return 'Please choose an image file.';
    }

    const extension = fileExtension(file.name);
    const mimeType = String(file.type || '').toLowerCase();
    const mimeAccepted = VALID_MIME_TYPES.has(mimeType);
    const extensionAccepted = VALID_EXTENSIONS.has(extension);

    if (!mimeAccepted && !extensionAccepted) {
      return 'Only PNG, JPG, and JPEG images are allowed.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'Please choose an image smaller than 1.5 MB.';
    }

    return null;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  function createAvatarContent(user, storedProfilePicture) {
    const content = document.createElement(storedProfilePicture ? 'img' : 'span');

    if (storedProfilePicture) {
      content.className = 'profile-avatar-image';
      content.alt = 'Profile picture';
      content.src = storedProfilePicture.dataUrl;
      return content;
    }

    content.className = 'profile-avatar-placeholder';
    content.textContent = getInitials(user);
    content.setAttribute('aria-hidden', 'true');
    return content;
  }

  function setMessage(messageElement, text, isError = false) {
    if (!messageElement) {
      return;
    }

    if (!text) {
      messageElement.hidden = true;
      messageElement.textContent = '';
      return;
    }

    messageElement.hidden = false;
    messageElement.textContent = text;
    messageElement.dataset.state = isError ? 'error' : 'success';
  }

  function updateMenuState(menuElement, triggerButton, isOpen) {
    if (menuElement) {
      menuElement.hidden = !isOpen;
    }

    if (triggerButton) {
      triggerButton.setAttribute('aria-expanded', String(isOpen));
    }
  }

  function hideMenu() {
    if (!widgetState) {
      return;
    }

    updateMenuState(widgetState.menuElement, widgetState.avatarButton, false);
  }

  function openMenu() {
    if (!widgetState) {
      return;
    }

    updateMenuState(widgetState.menuElement, widgetState.avatarButton, true);
  }

  function toggleMenu() {
    if (!widgetState) {
      return;
    }

    const isOpen = !widgetState.menuElement.hidden;
    updateMenuState(widgetState.menuElement, widgetState.avatarButton, !isOpen);
  }

  async function performLogout() {
    if (!widgetState) {
      return;
    }

    const { logoutButton } = widgetState;
    if (logoutButton) {
      logoutButton.disabled = true;
      logoutButton.textContent = 'Signing out...';
    }

    try {
      if (window.apiClient) {
        await window.apiClient.postJson('/auth/logout', {}, 'Failed to sign out.');
      } else {
        await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
      }
    } catch (error) {
      // Redirect even if the backend session cleanup fails.
    }

    window.location.assign('/login');
  }

  function renderAvatar(user) {
    if (!widgetState) {
      return;
    }

    const storedProfilePicture = readStoredProfilePicture();
    const nextContent = createAvatarContent(user, storedProfilePicture);
    widgetState.avatarContent.replaceWith(nextContent);
    widgetState.avatarContent = nextContent;
  }

  async function handleSelectedFile(file) {
    if (!widgetState) {
      return;
    }

    const { messageElement, fileInput, user } = widgetState;
    const validationError = validateFile(file);

    if (validationError) {
      setMessage(messageElement, validationError, true);
      if (fileInput) {
        fileInput.value = '';
      }
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const persisted = persistProfilePicture({
        dataUrl,
        fileName: file.name,
        updatedAt: new Date().toISOString(),
      });

      if (!persisted) {
        setMessage(messageElement, 'Your browser blocked saving the avatar locally.', true);
        return;
      }

      renderAvatar(user);
      setMessage(messageElement, 'Profile picture updated.');
      hideMenu();
    } catch (error) {
      setMessage(messageElement, 'Could not process the selected image.', true);
    } finally {
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  function bindGlobalTriggers() {
    const profileTriggers = document.querySelectorAll('[data-mobile-profile-trigger]');
    profileTriggers.forEach((button) => {
      if (button.dataset.profileAvatarBound === 'true') {
        return;
      }

      button.dataset.profileAvatarBound = 'true';
      button.addEventListener('click', () => {
        if (widgetState?.menuElement.hidden) {
          openMenu();
          widgetState.avatarButton.focus();
          return;
        }

        toggleMenu();
      });
    });
  }

  function buildWidget(user) {
    const host = getWidgetHost();
    if (!host) {
      return null;
    }

    let widget = host.querySelector('[data-profile-avatar-widget]');
    if (widget) {
      return widget;
    }

    widget = document.createElement('div');
    widget.className = 'profile-avatar-widget';
    widget.dataset.profileAvatarWidget = 'true';

    const avatarButton = document.createElement('button');
    avatarButton.type = 'button';
    avatarButton.className = 'profile-avatar-trigger';
    avatarButton.setAttribute('aria-label', 'Open profile menu');
    avatarButton.setAttribute('aria-haspopup', 'menu');
    avatarButton.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'profile-avatar-menu';
    menu.hidden = true;

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.dataset.profileAction = 'upload';
    uploadButton.textContent = 'Upload Photo';

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.dataset.profileAction = 'logout';
    logoutButton.textContent = 'Logout';

    const messageElement = document.createElement('p');
    messageElement.className = 'profile-avatar-message';
    messageElement.hidden = true;
    messageElement.setAttribute('aria-live', 'polite');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg';
    fileInput.hidden = true;

    const avatarContent = createAvatarContent(user, readStoredProfilePicture());
    avatarButton.appendChild(avatarContent);
    menu.append(uploadButton, logoutButton);
    widget.append(avatarButton, menu, messageElement, fileInput);
    host.appendChild(widget);

    widgetState = {
      widget,
      avatarButton,
      avatarContent,
      menuElement: menu,
      messageElement,
      fileInput,
      logoutButton,
      user,
    };

    avatarButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    uploadButton.addEventListener('click', () => {
      hideMenu();
      fileInput.click();
    });

    logoutButton.addEventListener('click', () => {
      hideMenu();
      void performLogout();
    });

    fileInput.addEventListener('change', async () => {
      const [file] = Array.from(fileInput.files || []);
      await handleSelectedFile(file);
    });

    document.addEventListener('click', (event) => {
      if (!widget.contains(event.target)) {
        hideMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideMenu();
      }
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      renderAvatar(user);
    });

    renderAvatar(user);
    bindGlobalTriggers();
    window.profileAvatarOpenMenu = openMenu;
    window.profileAvatarCloseMenu = hideMenu;
    window.profileAvatarToggleMenu = toggleMenu;
    window.profileAvatarWidgetState = widgetState;
    return widget;
  }

  function initialize() {
    const authReady = window.authGuardReady;
    if (!authReady || typeof authReady.then !== 'function') {
      return;
    }

    authReady.then((user) => {
      if (!user) {
        return;
      }

      window.authCurrentUser = user;
      buildWidget(user);
      window.setTimeout(bindGlobalTriggers, MENU_ACTION_TIMEOUT_MS);
    });
  }

  initialize();
})();