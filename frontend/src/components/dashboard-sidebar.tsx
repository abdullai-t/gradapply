"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogoMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/tracker", label: "School tracker" },
  { href: "/emails", label: "Professor emails" },
  { href: "/ai-coach", label: "AI writing coach" },
  { href: "/profile", label: "My profile" },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();
  const { data } = useSession();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="border-b border-zinc-200 px-6 py-6 dark:border-zinc-800">
        <Link href="/tracker" className="flex items-center gap-3">
          <BrandLogoMark
            size={40}
            className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-violet-200 dark:ring-violet-800"
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight text-violet-700 dark:text-violet-400">
              GradApply
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Application companion
            </p>
          </div>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-l-4 border-violet-600 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100"
                  : "border-l-4 border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          {data?.user?.image ? (
            <Image
              src={data.user.image}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-800 dark:bg-violet-900 dark:text-violet-200">
              {(data?.user?.name ?? data?.user?.email ?? "?")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {data?.user?.name ?? "Signed in"}
            </div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {data?.user?.email}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
