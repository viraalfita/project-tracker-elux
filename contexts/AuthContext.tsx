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
   * @disabled OTP auth is currently disabled in the UI — kept for future use.
   */
  requestOTP: (email: string) => Promise<string>;
  /**
   * Step 2 of OTP login: verifies the code and authenticates the user.
   * Returns isFirstLogin=true when the user still has the invite placeholder name.
   * @disabled OTP auth is currently disabled in the UI — kept for future use.
   */
  verifyOTP: (otpId: string, code: string) => Promise<{ isFirstLogin: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  login: async () => {},
  requestOTP: async () => "",
  verifyOTP: async () => ({ isFirstLogin: false }),
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
      const isFirstLogin = user.name === INVITED_PLACEHOLDER || !user.name.trim();
      return { isFirstLogin };
    },
    [],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, requestOTP, verifyOTP, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
