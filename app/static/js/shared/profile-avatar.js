(function initializeProfileAvatar() {
  const STORAGE_KEY = 'pocket-tracker.profile-picture';
  const MAX_FILE_SIZE_BYTES = 1572864;
  const VALID_MIME_TYPES = new Set(['image/png', 'image/jpeg']);
  const VALID_EXTENSIONS = new Set(['png', 'jpg', 'jpeg']);

  function getWidgetHost() {
    return document.querySelector('.top-links-row') || document.querySelector('.top-links');
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
      messageElement.dataset.state = '';
      return;
    }

    messageElement.hidden = false;
    messageElement.textContent = text;
    messageElement.dataset.state = isError ? 'error' : 'success';
  }

  function hideMenu(menuElement, menuButton) {
    if (menuElement) {
      menuElement.hidden = true;
    }

    if (menuButton) {
      menuButton.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleMenu(menuElement, menuButton) {
    if (!menuElement || !menuButton) {
      return;
    }

    const isHidden = menuElement.hidden;
    menuElement.hidden = !isHidden;
    menuButton.setAttribute('aria-expanded', String(isHidden));
  }

  function renderAvatar(state, user) {
    const storedProfilePicture = readStoredProfilePicture();
    const { avatarButton, avatarContent, removeButton } = state;

    if (!avatarButton || !avatarContent) {
      return;
    }

    const nextContent = createAvatarContent(user, storedProfilePicture);
    avatarContent.replaceWith(nextContent);
    state.avatarContent = nextContent;

    if (removeButton) {
      removeButton.hidden = !storedProfilePicture;
    }
  }

  async function handleSelectedFile(file, state) {
    const { messageElement, menuElement, menuButton, fileInput, user } = state;
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

      renderAvatar(state, user);
      setMessage(messageElement, 'Profile picture updated.');
      hideMenu(menuElement, menuButton);
    } catch (error) {
      setMessage(messageElement, 'Could not process the selected image.', true);
    } finally {
      if (fileInput) {
        fileInput.value = '';
      }
    }
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
    avatarButton.setAttribute('aria-label', 'Change profile picture');

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'profile-avatar-menu-toggle';
    menuButton.textContent = '...';
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Profile picture options');

    const menu = document.createElement('div');
    menu.className = 'profile-avatar-menu';
    menu.hidden = true;

    const changeButton = document.createElement('button');
    changeButton.type = 'button';
    changeButton.dataset.profileAction = 'change';
    changeButton.textContent = 'Change photo';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.dataset.profileAction = 'remove';
    removeButton.textContent = 'Remove photo';

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
    menu.append(changeButton, removeButton);
    widget.append(avatarButton, menuButton, menu, messageElement, fileInput);
    host.appendChild(widget);

    const state = {
      widget,
      avatarButton,
      avatarContent,
      menuButton,
      menuElement: menu,
      messageElement,
      fileInput,
      removeButton,
      user,
    };

    avatarButton.addEventListener('click', () => {
      hideMenu(menu, menuButton);
      fileInput.click();
    });

    menuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu(menu, menuButton);
    });

    changeButton.addEventListener('click', () => {
      hideMenu(menu, menuButton);
      fileInput.click();
    });

    removeButton.addEventListener('click', () => {
      const removed = clearProfilePicture();
      if (!removed) {
        setMessage(messageElement, 'Your browser blocked removing the saved avatar.', true);
        return;
      }

      renderAvatar(state, user);
      setMessage(messageElement, 'Profile picture removed.');
      hideMenu(menu, menuButton);
    });

    fileInput.addEventListener('change', async () => {
      const [file] = Array.from(fileInput.files || []);
      await handleSelectedFile(file, state);
    });

    document.addEventListener('click', (event) => {
      if (!widget.contains(event.target)) {
        hideMenu(menu, menuButton);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideMenu(menu, menuButton);
      }
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      renderAvatar(state, user);
    });

    renderAvatar(state, user);
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
    });
  }

  initialize();
})();