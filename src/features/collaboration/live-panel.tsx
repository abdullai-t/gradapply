"use client";

import { useEffect, useState } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  useOthers,
  useSelf,
  useStorage,
  useMutation,
} from "@liveblocks/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  roomId: string;
  sessionId: string;
  initialBody: string;
  guestToken?: string;
  canEdit: boolean;
  onEndLive?: (body: string) => void;
};

function LiveDocEditor({
  initialBody,
  canEdit,
  onEndLive,
}: {
  initialBody: string;
  canEdit: boolean;
  onEndLive?: (body: string) => void;
}) {
  const self = useSelf();
  const others = useOthers();
  const draft = useStorage((root) => root.draft) as string | undefined;
  const [local, setLocal] = useState(initialBody);

  const updateDraft = useMutation(
    ({ storage }, value: string) => {
      storage.set("draft", value);
    },
    [],
  );

  useEffect(() => {
    if (draft === undefined && canEdit) {
      updateDraft(initialBody);
    }
  }, [draft, initialBody, canEdit, updateDraft]);

  const display = draft ?? local;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-container-low)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--primary)]">
          Live session
        </p>
        <p className="text-xs text-[var(--on-surface-variant)]">
          {self?.info?.name ?? "You"}
          {others.length > 0
            ? ` · ${others.length} other scholar${others.length === 1 ? "" : "s"} online`
            : ""}
        </p>
      </div>
      <Textarea
        readOnly={!canEdit}
        value={display}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          if (canEdit) updateDraft(v);
        }}
        rows={12}
        className="font-mono text-sm"
      />
      {onEndLive ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEndLive(display)}
        >
          End live & save to my SOP
        </Button>
      ) : null}
    </div>
  );
}

function LiveRoomInner(props: Omit<Props, "roomId" | "sessionId" | "guestToken">) {
  return <LiveDocEditor {...props} />;
}

export function CollaborationLivePanel({
  roomId,
  guestToken,
  ...rest
}: Props) {
  const publicKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim();

  if (!publicKey) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        Live collaboration is not configured. Set{" "}
        <code className="text-xs">NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY</code> to
        enable presence and co-editing.
      </p>
    );
  }

  return (
    <LiveblocksProvider
      authEndpoint={async (room) => {
        const res = await fetch("/api/collaboration/liveblocks-auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(guestToken
              ? { "X-Collab-Guest-Token": guestToken }
              : {}),
          },
          body: JSON.stringify({ room }),
        });
        if (!res.ok) {
          throw new Error("Liveblocks auth failed");
        }
        return res.json();
      }}
    >
      <RoomProvider
        id={roomId}
        initialStorage={{ draft: rest.initialBody }}
      >
        <LiveRoomInner {...rest} />
      </RoomProvider>
    </LiveblocksProvider>
  );
}

export function CollaborationLivePanelLoading() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      Connecting live session…
    </div>
  );
}
