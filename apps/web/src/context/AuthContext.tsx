/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearSession,
  getStoredToken,
  getStoredUser,
  login as loginRequest,
  storeSession,
} from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email, password);
    storeSession(session);
    setToken(session.access_token);
    setUser(session.user);
  }, []);

  useEffect(() => {
    window.addEventListener("opsmind:unauthorized", logout);
    return () => window.removeEventListener("opsmind:unauthorized", logout);
  }, [logout]);

  const value = useMemo(
    () => ({ token, user, login, logout }),
    [token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
