"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import type { AppSession } from "@/auth";
import type { UserRole } from "@prisma/client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { syncSessionCookie } from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  session: AppSession | null;
  status: AuthStatus;
  firebaseUser: User | null;
  refreshSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSessionProfile(
  firebaseUser: User,
  seq: number,
  seqRef: { current: number },
): Promise<AppSession | null> {
  try {
    await syncSessionCookie(firebaseUser);
    if (seq !== seqRef.current) return null;

    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (seq !== seqRef.current) return null;
    if (!res.ok) return null;

    const data = await res.json();
    if (seq !== seqRef.current) return null;
    if (!data?.user?.id) return null;

    return {
      user: {
        id: data.user.id as string,
        email: data.user.email ?? null,
        name: data.user.name ?? null,
        image: data.user.image ?? null,
        role: data.user.role as UserRole | undefined,
      },
    };
  } catch {
    return null;
  }
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const profileSeqRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) {
      setSession(null);
      setStatus("unauthenticated");
      return;
    }
    const seq = ++profileSeqRef.current;
    const next = await fetchSessionProfile(user, seq, profileSeqRef);
    if (seq !== profileSeqRef.current) return;
    setSession(next);
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setStatus("unauthenticated");
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        profileSeqRef.current += 1;
        setSession(null);
        setStatus("unauthenticated");
        return;
      }
      setStatus("loading");
      const seq = ++profileSeqRef.current;
      const next = await fetchSessionProfile(user, seq, profileSeqRef);
      if (seq !== profileSeqRef.current) return;
      setSession(next);
      setStatus(next ? "authenticated" : "unauthenticated");
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ session, status, firebaseUser, refreshSession }),
    [session, status, firebaseUser, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
