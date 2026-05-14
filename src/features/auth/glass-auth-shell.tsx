import Link from "next/link";

import { Icon } from "@/components/icon";
import { GoogleIcon } from "@/features/auth/google-icon";

export function GlassAuthShell({
  title,
  description,
  children,
  footer,
  topBanners,
  icon = "login",
  showBrand = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  topBanners?: React.ReactNode;
  icon?: string;
  showBrand?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="float-blob absolute -left-24 top-10 h-80 w-80 rounded-full"
          style={{ background: "rgba(34,197,94,0.25)", filter: "blur(90px)" }}
        />
        <div
          className="float-blob absolute bottom-24 right-16 h-96 w-96 rounded-full"
          style={{ background: "rgba(168,85,247,0.22)", filter: "blur(100px)" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
        {showBrand ? (
          <Link
            href="/"
            aria-label="GradApply — back home"
            className="mb-8 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <GlassBrandMark />
          </Link>
        ) : null}

        {topBanners ? (
          <div className="mb-5 w-full max-w-[400px] space-y-3">{topBanners}</div>
        ) : null}

        <div className="w-full max-w-[400px] rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <header className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white/90">
              <Icon name={icon} size={24} />
            </div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            {description ? (
              <p className="m-0 mt-2 max-w-[30ch] text-sm leading-relaxed text-white/50">
                {description}
              </p>
            ) : null}
          </header>
          {children}
        </div>

        {footer ? (
          <div className="mt-8 text-center text-sm text-white/45">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

function GlassBrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl text-white"
        style={{ background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)" }}
      >
        <Icon name="auto_stories" fill size={22} />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight text-white">GradApply</div>
        <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/40">
          Scholar Pursuit Hub
        </div>
      </div>
    </div>
  );
}

export function GlassAuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-white/10" />
      </div>
    </div>
  );
}

export function GlassGoogleLabel() {
  return (
    <span className="inline-flex items-center justify-center gap-2.5">
      <GoogleIcon />
      Google
    </span>
  );
}

export function glassBannerClass(tone: "info" | "error" | "success") {
  if (tone === "error") {
    return "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100";
  }
  if (tone === "success") {
    return "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100";
  }
  return "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70";
}
