import { API_BASE_URL } from './apiConfig';
import { getAuth, setAuth } from './authStore';

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Attach HTTP status and API `code` so callers can branch (e.g. PayFast unavailable). */
function createHttpError(message, { code, status } = {}) {
  const err = new Error(message);
  if (code != null) err.code = code;
  if (status != null) err.status = status;
  return err;
}

/** Single-flight refresh so parallel 401s don't stampede the server. */
let refreshInFlight = null;

/**
 * Exchange refresh token for a new access token and persist via setAuth.
 * @param {string} [explicitRefreshToken] — use when getAuth() is not hydrated yet (e.g. LoadingScreen).
 * @returns {Promise<string|null>} new access token or null
 */
export async function refreshAccessToken(explicitRefreshToken) {
  const rt = explicitRefreshToken ?? getAuth()?.refreshToken;
  if (!rt) return null;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const url = `${API_BASE_URL}/api/auth/refresh-token`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      const text = await res.text();
      const json = safeJsonParse(text);
      if (!res.ok || !json?.token) return null;

      const prev = getAuth();
      setAuth({
        token: json.token,
        refreshToken: rt,
        user: json.user ?? prev?.user ?? null,
      });
      return json.token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function getJson(path, { token, quiet, _retryAfterRefresh } = {}) {
  const authToken = token ?? getAuth()?.token;
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    const text = await res.text();
    const json = safeJsonParse(text);

    if (res.status === 401 && !_retryAfterRefresh && getAuth()?.refreshToken) {
      const newTok = await refreshAccessToken();
      if (newTok) {
        return getJson(path, { token: newTok, quiet, _retryAfterRefresh: true });
      }
    }

    if (!res.ok) {
      let message = json?.error || json?.message || `Request failed with ${res.status}`;
      if (res.status === 404 && message === 'Application not found') {
        message = `Server not reachable (Railway: no app at this URL). Check API_BASE_URL and deployment. Request: GET ${url}`;
      }
      throw createHttpError(message, { code: json?.code, status: res.status });
    }
    return json ?? {};
  } catch (err) {
    if (!quiet) console.error('[API] GET', url, err.message);
    throw err;
  }
}

export async function patchJson(path, body, { token, quiet, _retryAfterRefresh } = {}) {
  const authToken = token ?? getAuth()?.token;
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    const json = safeJsonParse(text);

    if (res.status === 401 && !_retryAfterRefresh && getAuth()?.refreshToken) {
      const newTok = await refreshAccessToken();
      if (newTok) {
        return patchJson(path, body, { token: newTok, quiet, _retryAfterRefresh: true });
      }
    }

    if (!res.ok) {
      let message = json?.error || json?.message || `Request failed with ${res.status}`;
      if (res.status === 404 && message === 'Application not found') {
        message = `Server not reachable (Railway: no app at this URL). Check API_BASE_URL and deployment. Request: PATCH ${url}`;
      }
      throw createHttpError(message, { code: json?.code, status: res.status });
    }
    return json ?? {};
  } catch (err) {
    if (!quiet) console.error('[API] PATCH', url, err.message);
    throw err;
  }
}

export async function deleteJson(path, { token, quiet, _retryAfterRefresh } = {}) {
  const authToken = token ?? getAuth()?.token;
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
    const text = await res.text();
    const json = safeJsonParse(text);

    if (res.status === 401 && !_retryAfterRefresh && getAuth()?.refreshToken) {
      const newTok = await refreshAccessToken();
      if (newTok) {
        return deleteJson(path, { token: newTok, quiet, _retryAfterRefresh: true });
      }
    }

    if (!res.ok) {
      let message = json?.error || json?.message || `Request failed with ${res.status}`;
      if (res.status === 404 && message === 'Application not found') {
        message = `Server not reachable (Railway: no app at this URL). Check API_BASE_URL and deployment. Request: DELETE ${url}`;
      }
      throw createHttpError(message, { code: json?.code, status: res.status });
    }
    return json ?? {};
  } catch (err) {
    if (!quiet) console.error('[API] DELETE', url, err.message);
    throw err;
  }
}

export async function postJson(path, body, { token, quiet, _retryAfterRefresh, skipAuthRetry, omitAuthToken } = {}) {
  const authToken = omitAuthToken ? null : token ?? getAuth()?.token;
  const url = `${API_BASE_URL}${path}`;
  console.log('[API] POST', url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    const json = safeJsonParse(text);

    console.log('[API] Response:', res.status, json);

    if (
      res.status === 401 &&
      !_retryAfterRefresh &&
      !skipAuthRetry &&
      getAuth()?.refreshToken
    ) {
      const newTok = await refreshAccessToken();
      if (newTok) {
        return postJson(path, body, {
          token: newTok,
          quiet,
          _retryAfterRefresh: true,
          skipAuthRetry,
          omitAuthToken,
        });
      }
    }

    if (!res.ok) {
      let message = json?.error || json?.message || `Request failed with ${res.status}`;
      if (res.status === 404 && message === 'Application not found') {
        message = `Server not reachable (Railway: no app at this URL). Check API_BASE_URL and deployment. Request: POST ${url}`;
      }
      throw createHttpError(message, { code: json?.code, status: res.status });
    }

    return json ?? {};
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[API] Timeout:', url);
      throw new Error('Request timed out. Check your internet connection.');
    }
    if (!quiet) console.error('[API] POST', url, err.message);
    throw err;
  }
}
