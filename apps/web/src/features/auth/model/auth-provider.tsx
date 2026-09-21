"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
} from "@aitvaras/contracts";
import { ApiError, apiFetch } from "@/shared/api";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Clear client session state without calling the API (e.g. on a 401). */
  clearSession: () => void;
  /** Replace the cached current user (e.g. after a self-profile update). */
  replaceUser: (user: AuthenticatedUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Cookie-based auth provider.
 *
 * The httpOnly auth cookie is the single source of truth; the client learns the
 * current user from `GET /auth/me`. There is no readable token in the browser.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const me = await apiFetch<AuthenticatedUser>("/auth/me");
        if (active) {
          setUser(me);
        }
      } catch (caught) {
        if (active) {
          // 401 (no/expired cookie) or any error → treat as signed out.
          setUser(null);
          void caught;
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginRequest): Promise<void> => {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(result.user);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (caught) {
      // Even if the API call fails, drop client state; the cookie is httpOnly.
      void caught;
    } finally {
      setUser(null);
    }
  }, []);

  const clearSession = useCallback((): void => setUser(null), []);

  const replaceUser = useCallback(
    (nextUser: AuthenticatedUser): void => setUser(nextUser),
    [],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, clearSession, replaceUser }),
    [user, loading, login, logout, clearSession, replaceUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/** True when an error is an authentication failure (401). */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
