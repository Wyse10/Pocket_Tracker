(function initializeApiClient() {
  function redirectToLogin() {
    if (window.location.pathname === '/login') {
      return;
    }

    const currentPath = `${window.location.pathname}${window.location.search || ''}`;
    const loginUrl = new URL('/login', window.location.origin);
    loginUrl.searchParams.set('next', currentPath);
    window.location.assign(loginUrl.toString());
  }

  async function parseJsonSafe(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function errorMessageFromPayload(payload, fallbackMessage) {
    if (!payload) {
      return fallbackMessage;
    }

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail;
    }

    if (Array.isArray(payload.detail) && payload.detail.length) {
      return JSON.stringify(payload.detail);
    }

    return fallbackMessage;
  }

  async function requestJson(url, options = {}, fallbackMessage = 'Request failed.') {
    const { body, headers, ...rest } = options;

    const requestOptions = {
      ...rest,
      credentials: 'same-origin',
      headers: {
        ...(headers || {}),
      },
    };

    if (body !== undefined) {
      requestOptions.body = JSON.stringify(body);
      requestOptions.headers['Content-Type'] = requestOptions.headers['Content-Type'] || 'application/json';
    }

    const response = await fetch(url, requestOptions);
    const payload = await parseJsonSafe(response);

    if (response.status === 401) {
      redirectToLogin();
      throw new Error('Authentication required.');
    }

    if (!response.ok) {
      const error = new Error(errorMessageFromPayload(payload, fallbackMessage));
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  window.apiClient = {
    requestJson,
    getJson(url, fallbackMessage = 'Request failed.') {
      return requestJson(url, { method: 'GET' }, fallbackMessage);
    },
    postJson(url, body, fallbackMessage = 'Request failed.') {
      return requestJson(url, { method: 'POST', body }, fallbackMessage);
    },
    putJson(url, body, fallbackMessage = 'Request failed.') {
      return requestJson(url, { method: 'PUT', body }, fallbackMessage);
    },
    deleteJson(url, fallbackMessage = 'Request failed.') {
      return requestJson(url, { method: 'DELETE' }, fallbackMessage);
    },
  };
})();
