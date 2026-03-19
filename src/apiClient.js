import { API_BASE_URL } from './apiConfig';

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function getJson(path, { token } = {}) {
  const url = `${API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) {
      const message = json?.error || json?.message || `Request failed with ${res.status}`;
      throw new Error(message);
    }
    return json ?? {};
  } catch (err) {
    console.error('[API] GET Error:', err.message);
    throw err;
  }
}

export async function postJson(path, body, { token } = {}) {
  const url = `${API_BASE_URL}${path}`;
  console.log('[API] POST', url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    const json = safeJsonParse(text);

    console.log('[API] Response:', res.status, json);

    if (!res.ok) {
      const message = json?.error || json?.message || `Request failed with ${res.status}`;
      throw new Error(message);
    }

    return json ?? {};
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[API] Timeout:', url);
      throw new Error('Request timed out. Check your internet connection.');
    }
    console.error('[API] Error:', err.message);
    throw err;
  }
}

