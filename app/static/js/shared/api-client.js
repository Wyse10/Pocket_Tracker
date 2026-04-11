(function initializeApiClient() {
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

    if (!response.ok) {
      throw new Error(errorMessageFromPayload(payload, fallbackMessage));
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
    deleteJson(url, fallbackMessage = 'Request failed.') {
      return requestJson(url, { method: 'DELETE' }, fallbackMessage);
    },
  };
})();
