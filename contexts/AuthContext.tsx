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

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  login: async () => {},
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

    // Validate the token against the server and refresh user data
    pb.collection("users")
      .authRefresh()
      .then((data) => {
        setCurrentUser(mapUser(data.record as unknown as PBUser));
      })
      .catch(() => {
        // Token expired or invalid — clear auth
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

  const logout = useCallback(() => {
    pb.authStore.clear();
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
