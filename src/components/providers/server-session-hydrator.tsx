"use client";

import { useEffect } from "react";

import type { AppSession } from "@/auth";
import { useHydrateServerSession } from "@/hooks/use-auth";

/** Applies RSC session to the Firebase auth context so the shell skips client `/api/auth/me` when UIDs match. */
export function ServerSessionHydrator({
  session,
}: {
  session: AppSession;
}) {
  const hydrateServerSession = useHydrateServerSession();

  useEffect(() => {
    hydrateServerSession(session);
  }, [session, hydrateServerSession]);

  return null;
}
