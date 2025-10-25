import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, setAuthTokens, setLogoutHandler, setRefreshHandler } from '../api/client';
import type { User } from '../types';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginPayload {
  username: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'avaliacao_municipal_tokens';

async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/accounts/me/');
  return data;
}

async function obtainToken(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<{ access: string; refresh: string }>(
    '/auth/token/',
    payload
  );
  return { accessToken: data.access, refreshToken: data.refresh };
}

async function refreshToken(refreshToken: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<{ access: string }>(
    '/auth/refresh/',
    { refresh: refreshToken }
  );
  return { accessToken: data.access, refreshToken };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const persistTokens = useCallback((value: AuthTokens | null) => {
    setTokens(value);
    setAuthTokens(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    persistTokens(null);
    setUser(null);
  }, [persistTokens]);

  const refresh = useCallback(async () => {
    if (!tokens?.refreshToken) {
      return null;
    }
    try {
      const newTokens = await refreshToken(tokens.refreshToken);
      persistTokens(newTokens);
      return newTokens.accessToken;
    } catch (error) {
      logout();
      return null;
    }
  }, [logout, persistTokens, tokens?.refreshToken]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const obtainedTokens = await obtainToken(payload);
      persistTokens(obtainedTokens);
      const fetchedUser = await fetchCurrentUser();
      setUser(fetchedUser);
    },
    [persistTokens]
  );

  useEffect(() => {
    setLogoutHandler(logout);
    setRefreshHandler(refresh);
    return () => {
      setLogoutHandler(null);
      setRefreshHandler(null);
    };
  }, [logout, refresh]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const stored = JSON.parse(raw) as AuthTokens;
      persistTokens(stored);
      fetchCurrentUser()
        .then((fetched) => {
          setUser(fetched);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.error('Failed to parse stored tokens', error);
      persistTokens(null);
      setLoading(false);
    }
  }, [persistTokens]);

  useEffect(() => {
    if (!tokens) {
      setUser(null);
    } else if (!user) {
      fetchCurrentUser()
        .then(setUser)
        .catch(() => logout());
    }
  }, [tokens, user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, tokens, loading, login, logout, refresh }),
    [user, tokens, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return ctx;
}
