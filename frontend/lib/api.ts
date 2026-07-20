export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const apiBaseUrl = API_URL;

export type AuthUser = {
  name: string;
  email: string;
  role: string;
  permissions?: string[];
};

export type LoginResponse = {
  accessToken?: string;
  user?: AuthUser;
  require2FA?: boolean;
  message?: string;
};

export function getToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('accessToken');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function authFetch(path: string, init: RequestInit = {}) {
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    ...authHeaders(),
  };

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await authFetch(path, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Erro ao buscar ${path}`);
  }
  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro ao enviar ${path}`);
  }
  return response.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await authFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro ao atualizar ${path}`);
  }
  return response.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await authFetch(path, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro ao remover ${path}`);
  }
  return response.json();
}

export async function login(email: string, password: string, twoFactorCode?: string) {
  const response = await apiPost<LoginResponse>('/auth/login', { email, password, twoFactorCode });
  if (response.accessToken) {
    setAuthSession(response.accessToken, response.user);
  }
  return response;
}

export function setAuthSession(accessToken: string, user?: AuthUser) {
  window.localStorage.setItem('accessToken', accessToken);
  if (user) {
    window.localStorage.setItem('user', JSON.stringify(user));
  }
  document.cookie = `accessToken=${accessToken}; path=/; max-age=28800; SameSite=Lax`;
}

export function logout() {
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('user');
  document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
}

export const clearAuthSession = logout;
