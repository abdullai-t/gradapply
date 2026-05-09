"use client";

import * as React from "react";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "gradapply.theme";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function resolvePreference(p: ThemePreference): "light" | "dark" {
  if (p === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return p;
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({
  children,
  initialPreference,
}: {
  children: React.ReactNode;
  initialPreference?: ThemePreference;
}) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(
    initialPreference ?? "system",
  );
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  // On first mount, read storage and apply.
  React.useEffect(() => {
    const initial = readStoredPreference();
    setPreferenceState(initial);
    const r = resolvePreference(initial);
    setResolved(r);
    applyTheme(r);
  }, []);

  // Track system changes when in "system" mode.
  React.useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = React.useCallback((next: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
    const r = resolvePreference(next);
    setResolved(r);
    applyTheme(r);
  }, []);

  const value = React.useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Tolerant fallback for non-provider trees (e.g. error boundaries)
    return {
      preference: "system",
      resolved: "light",
      setPreference: () => undefined,
    };
  }
  return ctx;
}

/**
 * Inline script to prevent FOUC: read storage + system pref synchronously
 * and set `class="dark"` before React hydrates.
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var r=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;var d=document.documentElement;if(r==='dark')d.classList.add('dark');d.style.colorScheme=r;}catch(e){}})();`;
