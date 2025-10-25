import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

let authTokens: Tokens | null = null;
let refreshFn: (() => Promise<string | null>) | null = null;
let logoutFn: (() => void) | null = null;
let refreshingPromise: Promise<string | null> | null = null;

export const apiClient = axios.create({
  baseURL,
  withCredentials: false
});

export const setAuthTokens = (tokens: Tokens | null) => {
  authTokens = tokens;
};

export const setRefreshHandler = (fn: (() => Promise<string | null>) | null) => {
  refreshFn = fn;
};

export const setLogoutHandler = (fn: (() => void) | null) => {
  logoutFn = fn;
};

apiClient.interceptors.request.use((config) => {
  if (authTokens?.accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authTokens.accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      refreshFn &&
      authTokens?.refreshToken &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshingPromise) {
          refreshingPromise = refreshFn().finally(() => {
            refreshingPromise = null;
          });
        }
        const newAccess = await refreshingPromise;
        if (newAccess) {
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Failed to refresh token', refreshError);
      }
      if (logoutFn) {
        logoutFn();
      }
    }
    return Promise.reject(error);
  }
);
