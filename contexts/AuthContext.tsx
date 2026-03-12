"use client";

import { mapUser } from "@/lib/pb-mappers";
import { PBUser } from "@/lib/pb-types";
import { pb } from "@/lib/pocketbase";
import { User } from "@/lib/types";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** Placeholder name set on user records created via the invite flow. */
export const INVITED_PLACEHOLDER = "(Invited)";

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  /** Password-based login (active). */
  login: (email: string, password: string) => Promise<void>;
  /**
   * Step 1 of OTP login: sends a 6-digit code to the user's email.
   * Returns the otpId needed for step 2.
   */
  requestOTP: (email: string) => Promise<string>;
  /**
   * Step 2 of OTP login: verifies the code and authenticates the user.
   * Returns isFirstLogin=true when the user still has the invite placeholder name.
   */
  verifyOTP: (
    otpId: string,
    code: string,
  ) => Promise<{ isFirstLogin: boolean }>;
  /**
   * Fallback login via a one-time backup code.
   * Calls POST /api/auth/backup-code (server-side hashed validation).
   * Returns the number of remaining unused codes so the UI can warn the user.
   */
  loginWithBackupCode: (
    email: string,
    code: string,
  ) => Promise<{ remaining: number }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  login: async () => {},
  requestOTP: async () => "",
  verifyOTP: async () => ({ isFirstLogin: false }),
  loginWithBackupCode: async () => ({ remaining: 0 }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from pb.authStore (persisted in localStorage)
    if (pb.authStore.isValid && pb.authStore.model) {
      setCurrentUser(mapUser(pb.authStore.model as unknown as PBUser));
    }

    // Validate token against the server and refresh user data
    pb.collection("users")
      .authRefresh()
      .then((data) => {
        setCurrentUser(mapUser(data.record as unknown as PBUser));
      })
      .catch(() => {
        pb.authStore.clear();
        setCurrentUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Keep currentUser in sync with authStore changes (e.g. logout from another tab)
    const unsub = pb.authStore.onChange((_token, model) => {
      setCurrentUser(model ? mapUser(model as unknown as PBUser) : null);
    });

    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const authData = await pb
      .collection("users")
      .authWithPassword(email, password);
    setCurrentUser(mapUser(authData.record as unknown as PBUser));
  }, []);

  const requestOTP = useCallback(async (email: string): Promise<string> => {
    const result = await pb.collection("users").requestOTP(email);
    return result.otpId;
  }, []);

  const verifyOTP = useCallback(
    async (otpId: string, code: string): Promise<{ isFirstLogin: boolean }> => {
      const authData = await pb.collection("users").authWithOTP(otpId, code);
      const user = mapUser(authData.record as unknown as PBUser);
      setCurrentUser(user);
      const isFirstLogin =
        user.name === INVITED_PLACEHOLDER || !user.name.trim();
      return { isFirstLogin };
    },
    [],
  );

  /**
   * Authenticate with a one-time backup code.
   * Validation is entirely server-side — raw code never leaves this function
   * unvalidated. On success the PocketBase authStore is populated so the rest
   * of the app sees an authenticated session immediately.
   */
  const loginWithBackupCode = useCallback(
    async (email: string, code: string): Promise<{ remaining: number }> => {
      const res = await fetch("/api/auth/backup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Invalid email or backup code.");
      }
      // Hydrate PocketBase authStore with the server-issued token
      pb.authStore.save(data.token, data.record);
      setCurrentUser(mapUser(data.record as unknown as PBUser));
      return { remaining: data.remaining ?? 0 };
    },
    [],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        requestOTP,
        verifyOTP,
        loginWithBackupCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
