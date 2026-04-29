"use client";

import { signOut, useSession } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data } = useSession();
  const user = data?.user;

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ??
    user?.email?.slice(0, 2).toUpperCase() ??
    "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "relative h-11 w-full gap-2.5 px-2 text-left",
            compact ? "justify-center" : "justify-start",
          )}
        >
          <Avatar className="h-8 w-8 border-2 border-[var(--primary-fixed)] bg-[var(--primary-fixed)]">
            <AvatarImage src={user?.image ?? undefined} alt="" />
            <AvatarFallback className="bg-[var(--primary-fixed)] text-[var(--primary)] font-extrabold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-bold",
              compact ? "hidden" : "hidden md:inline",
            )}
          >
            {user?.name ?? user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2 text-[var(--on-surface)] shadow-2xl"
      >
        <DropdownMenuItem
          className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-bold focus:bg-[var(--error-container)] focus:text-[var(--on-error-container)]"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <Icon name="logout" size={18} className="mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
