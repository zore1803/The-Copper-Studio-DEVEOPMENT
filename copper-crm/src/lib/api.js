const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}

export function apiPost(path, body, token) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export function apiGet(path, token) {
  return request(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export function apiPut(path, body, token) {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export function apiDelete(path, token) {
  return request(path, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}
