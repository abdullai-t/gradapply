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
import { fetchAppUserProfile, syncSessionCookie } from "@/lib/auth-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  session: AppSession | null;
  status: AuthStatus;
  firebaseUser: User | null;
  refreshSession: () => Promise<void>;
  /** RSC-provided session — skips `/api/auth/me` until Firebase UID differs. */
  hydrateServerSession: (session: AppSession) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

let profileInflight: Promise<AppSession | null> | null = null;
let profileInflightUid: string | null = null;

async function fetchSessionProfile(
  firebaseUser: User,
  seq: number,
  seqRef: { current: number },
  opts?: { forceCookie?: boolean },
): Promise<AppSession | null> {
  const uid = firebaseUser.uid;

  if (
    profileInflight &&
    profileInflightUid === uid &&
    !opts?.forceCookie
  ) {
    return profileInflight;
  }

  const run = (async () => {
    try {
      await syncSessionCookie(firebaseUser, { force: opts?.forceCookie });
      if (seq !== seqRef.current) return null;

      const profile = await fetchAppUserProfile();
      if (seq !== seqRef.current) return null;

      return {
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          image: profile.image,
          role: profile.role as UserRole | undefined,
        },
      };
    } catch {
      return null;
    } finally {
      if (profileInflightUid === uid) {
        profileInflight = null;
        profileInflightUid = null;
      }
    }
  })();

  profileInflight = run;
  profileInflightUid = uid;
  return run;
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const profileSeqRef = useRef(0);
  const lastHydratedUidRef = useRef<string | null>(null);

  const hydrateServerSession = useCallback((next: AppSession) => {
    setSession(next);
    setStatus("authenticated");
    lastHydratedUidRef.current = next.user.id;
  }, []);

  const refreshSession = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) {
      setSession(null);
      setStatus("unauthenticated");
      return;
    }
    const seq = ++profileSeqRef.current;
    const next = await fetchSessionProfile(user, seq, profileSeqRef, {
      forceCookie: true,
    });
    if (seq !== profileSeqRef.current) return;
    setSession(next);
    setStatus(next ? "authenticated" : "unauthenticated");
    if (next) lastHydratedUidRef.current = user.uid;
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
        lastHydratedUidRef.current = null;
        setSession(null);
        setStatus("unauthenticated");
        return;
      }

      if (lastHydratedUidRef.current === user.uid) {
        setStatus("authenticated");
        return;
      }

      setStatus("loading");
      const seq = ++profileSeqRef.current;
      const next = await fetchSessionProfile(user, seq, profileSeqRef);
      if (seq !== profileSeqRef.current) return;
      setSession(next);
      setStatus(next ? "authenticated" : "unauthenticated");
      if (next) lastHydratedUidRef.current = user.uid;
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      session,
      status,
      firebaseUser,
      refreshSession,
      hydrateServerSession,
    }),
    [session, status, firebaseUser, refreshSession, hydrateServerSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
