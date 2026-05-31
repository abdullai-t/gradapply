import type { GoogleDocLinkEntityType } from "@prisma/client";

import { getDb } from "@/lib/prisma";

import { debounceGoogleDocSync } from "./debounce";
import { pushToGoogle, reconcileLink } from "./sync";

export function schedulePushToGoogle(
  userId: string,
  entityType: GoogleDocLinkEntityType,
  entityId: string,
): void {
  void (async () => {
    const db = getDb();
    const link = await db.googleDocLink.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });
    if (!link || link.userId !== userId) return;

    debounceGoogleDocSync(link.id, () => pushToGoogle(link.id));
  })();
}

export function schedulePullByFileId(fileId: string): void {
  void (async () => {
    const db = getDb();
    const link = await db.googleDocLink.findFirst({
      where: { googleFileId: fileId },
    });
    if (!link) return;

    debounceGoogleDocSync(link.id, () => reconcileLink(link.id));
  })();
}
