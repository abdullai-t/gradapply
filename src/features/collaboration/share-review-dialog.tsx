"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  useCreateCollaborationSession,
  useInviteCollaborator,
} from "./api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifactType: "SOP_VARIANT" | "PROF_EMAIL";
  entityId: string;
  titleHint?: string;
};

export function ShareReviewDialog({
  open,
  onOpenChange,
  artifactType,
  entityId,
  titleHint,
}: Props) {
  const router = useRouter();
  const createSession = useCreateCollaborationSession();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [guestUrl, setGuestUrl] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creatingGuestLink, setCreatingGuestLink] = useState(false);

  const invite = useInviteCollaborator(sessionId ?? "");

  const reset = () => {
    setSessionId(null);
    setGuestUrl(null);
    setInviteEmail("");
    setError(null);
    setCreatingGuestLink(false);
  };

  const handleCreate = async () => {
    setError(null);
    setCreatingGuestLink(true);
    try {
      const { session } = await createSession.mutateAsync({
        artifactType,
        entityId,
        title: titleHint,
      });
      setSessionId(session.id);
      const linkRes = await fetch(
        `/api/collaboration/sessions/${session.id}/guest-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Guest reviewer" }),
        },
      );
      if (!linkRes.ok) {
        const body = (await linkRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Could not create guest link");
      }
      const link = (await linkRes.json()) as { url: string };
      setGuestUrl(link.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setCreatingGuestLink(false);
    }
  };

  const handleInvite = async () => {
    if (!sessionId || !inviteEmail.trim()) return;
    setError(null);
    try {
      await invite.mutateAsync({ email: inviteEmail.trim() });
      setInviteEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    }
  };

  const copyGuest = async () => {
    if (!guestUrl) return;
    await navigator.clipboard.writeText(guestUrl);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share for review</DialogTitle>
          <DialogDescription>
            Invite another scholar or mentor to comment on a snapshot of this
            draft. They will not see your full account.
          </DialogDescription>
        </DialogHeader>

        {!sessionId ? (
          <>
            {error ? (
              <p className="text-sm text-[var(--error)]">{error}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                loading={createSession.isPending || creatingGuestLink}
              >
                Create review session
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            {guestUrl ? (
              <div className="space-y-2">
                <Label>Guest comment link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={guestUrl} className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyGuest()}
                    aria-label="Copy link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="invite-email">Invite GradApply user</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="peer@university.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={invite.isPending}
                  disabled={!inviteEmail.trim()}
                  onClick={() => void handleInvite()}
                >
                  Invite
                </Button>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-[var(--error)]">{error}</p>
            ) : null}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button asChild className="w-full">
                <Link
                  href={`/collaboration/${sessionId}`}
                  onClick={() => onOpenChange(false)}
                >
                  Open session
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/collaboration");
                }}
              >
                View all sessions
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
