import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { apiFetch, ApiError, SESSION_TOKEN_KEY } from '@/lib/api';
import { deleteSessionItem, getSessionItem, setSessionItem } from '@/lib/session-storage';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True while restoring a persisted session on app start. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app start, if a token is already stored, treat the app as logged in
  // optimistically and fetch the current user to confirm/refresh it. If the
  // token is expired or invalid, the profile call below clears it.
  useEffect(() => {
    (async () => {
      const token = await getSessionItem(SESSION_TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const profile = await apiFetch<AuthUser>('/api/profile');
        setUser({ id: profile.id, email: profile.email, name: profile.name });
      } catch {
        await deleteSessionItem(SESSION_TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setSessionItem(SESSION_TOKEN_KEY, res.token);
    setUser(res.user);
  }

  async function logout() {
    await deleteSessionItem(SESSION_TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
