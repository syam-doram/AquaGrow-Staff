import axios from 'axios';

// In dev: set VITE_API_BASE_URL=http://localhost:3005/api
// In production: Render backend
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'https://aquagrow.onrender.com/api';

export const TOKEN_KEY = 'aquagrow_staff_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string)       => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()              => localStorage.removeItem(TOKEN_KEY);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// Attach token automatically on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Global 401/403 handler — only redirect to login if NOT already on /login
// and NOT a background data request (let ProtectedRoute handle auth state)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url ?? '';
    const isAuthEndpoint = url.includes('/staff/login') || url.includes('/staff/me');
    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      clearToken();
      // Only hard-navigate if the token is truly gone (session expired)
      // Don't redirect for data-load failures (e.g. /invoices/summary) on the dashboard
      const isSessionCheck = url.includes('/staff/me');
      if (!isSessionCheck && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
