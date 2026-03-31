// VITE_API_URL задаётся в Vercel как переменная окружения
// Например: https://caravan-backend.up.railway.app
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  get:  <T = any>(path: string)               => request<T>('GET',  path),
  post: <T = any>(path: string, body: unknown) => request<T>('POST', path, body),
};
