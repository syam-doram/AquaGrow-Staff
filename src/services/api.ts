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

// Global 401/403 handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
