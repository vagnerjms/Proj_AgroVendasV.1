export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

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

  const baseUrl = getApiUrl();
  return fetch(`${baseUrl}${path}`, {
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

export async function login(email: string, password: string, twoFactorCode?: string, rememberMe: boolean = true) {
  const response = await apiPost<LoginResponse>('/auth/login', { email, password, twoFactorCode, rememberMe });
  if (response.accessToken) {
    setAuthSession(response.accessToken, response.user, rememberMe);
  }
  return response;
}

export function setAuthSession(accessToken: string, user?: AuthUser, rememberMe: boolean = true) {
  window.localStorage.setItem('accessToken', accessToken);
  if (user) {
    window.localStorage.setItem('user', JSON.stringify(user));
  }
  if (rememberMe) {
    window.localStorage.setItem('rememberMe', 'true');
  } else {
    window.localStorage.removeItem('rememberMe');
  }
  const maxAge = rememberMe ? 31536000 : 2592000;
  document.cookie = `accessToken=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function refreshAuthSession() {
  if (typeof window === 'undefined') return;
  const token = getToken();
  if (token) {
    const isOneYear = window.localStorage.getItem('rememberMe') === 'true';
    const maxAge = isOneYear ? 31536000 : 2592000;
    document.cookie = `accessToken=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

export function logout() {
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('user');
  window.localStorage.removeItem('rememberMe');
  document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
}

export const clearAuthSession = logout;
