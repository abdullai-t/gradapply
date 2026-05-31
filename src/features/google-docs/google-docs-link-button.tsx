"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";

import { useCreateGoogleDocLink, useGoogleDocLink } from "./api";

type Props = {
  entityType: "SOP_VARIANT" | "PROF_EMAIL" | "COLLABORATION_SESSION";
  entityId: string;
  className?: string;
};

export function GoogleDocsLinkButton({ entityType, entityId, className }: Props) {
  const linkQuery = useGoogleDocLink(entityType, entityId);
  const createLink = useCreateGoogleDocLink();

  const link = linkQuery.data?.link ?? null;
  const busy = linkQuery.isLoading || createLink.isPending;

  const openOrCreate = async () => {
    if (link?.googleDocUrl) {
      window.open(link.googleDocUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { link: created } = await createLink.mutateAsync({
        entityType,
        entityId,
      });
      if (created.googleDocUrl) {
        window.open(created.googleDocUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "GOOGLE_DRIVE_NOT_CONNECTED") {
        window.location.href = "/settings";
        return;
      }
      alert(err.message);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void openOrCreate()}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Icon name="description" size={16} className="mr-1" />
          )}
          {link ? "Open in Google Docs" : "Sync with Google Docs"}
        </Button>
        {link ? (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/settings">Drive settings</Link>
          </Button>
        ) : null}
      </div>
      {link?.lastSyncError ? (
        <p className="mt-1 text-xs text-[var(--error)]">
          Sync issue: {link.lastSyncError}
        </p>
      ) : link?.lastSyncedAt ? (
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          Last synced{" "}
          {new Date(link.lastSyncedAt).toLocaleString()}
          {link.lastSyncSource ? ` · from ${link.lastSyncSource}` : ""}
        </p>
      ) : link ? (
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          Changes in Google Docs sync automatically to GradApply.
        </p>
      ) : null}
    </div>
  );
}
