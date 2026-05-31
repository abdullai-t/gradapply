import type { GoogleDocLink } from "@prisma/client";

import { getDb } from "@/lib/prisma";
import { log } from "@/lib/logger";

import { createGoogleDocFromHtml } from "./create";
import { exportGoogleDocAsGradApplyHtml, getDriveFileMeta } from "./export";
import { applyWriteupContent, loadWriteupContent } from "./entity";
import { updateGoogleDocFromHtml } from "./update";
import {
  newWatchChannelToken,
  startFileWatch,
  stopChannel,
} from "./watch";

export async function pullFromGoogle(linkId: string): Promise<void> {
  const db = getDb();
  const link = await db.googleDocLink.findUnique({ where: { id: linkId } });
  if (!link) return;

  try {
    const html = await exportGoogleDocAsGradApplyHtml(
      link.userId,
      link.googleFileId,
    );
    const meta = await getDriveFileMeta(link.userId, link.googleFileId);
    await applyWriteupContent(
      link.userId,
      link.entityType,
      link.entityId,
      html,
    );

    await db.googleDocLink.update({
      where: { id: linkId },
      data: {
        headRevisionId: meta.headRevisionId ?? link.headRevisionId,
        driveModifiedTime: meta.modifiedTime
          ? new Date(meta.modifiedTime)
          : link.driveModifiedTime,
        lastSyncedAt: new Date(),
        lastSyncSource: "google",
        lastSyncError: null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.googleDocLink.update({
      where: { id: linkId },
      data: { lastSyncError: message },
    });
    log.warn("google_docs.pull_failed", { linkId, error: message });
    throw e;
  }
}

export async function pushToGoogle(linkId: string): Promise<void> {
  const db = getDb();
  const link = await db.googleDocLink.findUnique({ where: { id: linkId } });
  if (!link) return;

  try {
    const content = await loadWriteupContent(
      link.userId,
      link.entityType,
      link.entityId,
    );
    await updateGoogleDocFromHtml({
      userId: link.userId,
      fileId: link.googleFileId,
      htmlBody: content.htmlBody,
    });
    const meta = await getDriveFileMeta(link.userId, link.googleFileId);

    await db.googleDocLink.update({
      where: { id: linkId },
      data: {
        headRevisionId: meta.headRevisionId ?? link.headRevisionId,
        driveModifiedTime: meta.modifiedTime
          ? new Date(meta.modifiedTime)
          : link.driveModifiedTime,
        lastSyncedAt: new Date(),
        lastSyncSource: "gradapply",
        lastSyncError: null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.googleDocLink.update({
      where: { id: linkId },
      data: { lastSyncError: message },
    });
    log.warn("google_docs.push_failed", { linkId, error: message });
    throw e;
  }
}

export async function reconcileLink(linkId: string): Promise<void> {
  const db = getDb();
  const link = await db.googleDocLink.findUnique({ where: { id: linkId } });
  if (!link) return;

  const meta = await getDriveFileMeta(link.userId, link.googleFileId);
  const driveTime = meta.modifiedTime ? new Date(meta.modifiedTime) : null;
  const content = await loadWriteupContent(
    link.userId,
    link.entityType,
    link.entityId,
  );

  const revisionChanged =
    meta.headRevisionId &&
    link.headRevisionId &&
    meta.headRevisionId !== link.headRevisionId;

  const googleNewer =
    driveTime &&
    driveTime.getTime() > content.updatedAt.getTime() + 2000;

  const gradapplyNewer =
    content.updatedAt.getTime() >
    (link.driveModifiedTime?.getTime() ?? 0) + 2000;

  if (
    (revisionChanged || googleNewer) &&
    !gradapplyNewer &&
    link.lastSyncSource !== "gradapply"
  ) {
    await pullFromGoogle(linkId);
    return;
  }

  if (gradapplyNewer || link.lastSyncSource === "gradapply") {
    await pushToGoogle(linkId);
    return;
  }

  if (revisionChanged) {
    await pullFromGoogle(linkId);
  }
}

export async function createLinkForEntity(opts: {
  userId: string;
  entityType: GoogleDocLink["entityType"];
  entityId: string;
}): Promise<GoogleDocLink> {
  const db = getDb();
  const existing = await db.googleDocLink.findUnique({
    where: {
      entityType_entityId: {
        entityType: opts.entityType,
        entityId: opts.entityId,
      },
    },
  });
  if (existing) return existing;

  const content = await loadWriteupContent(
    opts.userId,
    opts.entityType,
    opts.entityId,
  );
  const created = await createGoogleDocFromHtml({
    userId: opts.userId,
    title: content.title,
    htmlBody: content.htmlBody,
  });

  const channelToken = newWatchChannelToken();
  const watch = await startFileWatch({
    userId: opts.userId,
    fileId: created.fileId,
    channelToken,
  });

  return db.googleDocLink.create({
    data: {
      userId: opts.userId,
      entityType: opts.entityType,
      entityId: opts.entityId,
      googleFileId: created.fileId,
      googleDocUrl: created.docUrl,
      headRevisionId: created.headRevisionId,
      driveModifiedTime: created.modifiedTime,
      watchChannelId: watch.channelId,
      watchResourceId: watch.resourceId,
      watchExpiresAt: watch.expiresAt,
      watchChannelToken: channelToken,
      lastSyncedAt: new Date(),
      lastSyncSource: "gradapply",
    },
  });
}

export async function deleteLinkForEntity(
  userId: string,
  entityType: GoogleDocLink["entityType"],
  entityId: string,
): Promise<void> {
  const db = getDb();
  const link = await db.googleDocLink.findFirst({
    where: { userId, entityType, entityId },
  });
  if (!link) return;

  if (link.watchChannelId && link.watchResourceId) {
    await stopChannel({
      userId,
      channelId: link.watchChannelId,
      resourceId: link.watchResourceId,
    });
  }

  await db.googleDocLink.delete({ where: { id: link.id } });
}

export async function renewWatchIfNeeded(link: GoogleDocLink): Promise<void> {
  const expires = link.watchExpiresAt?.getTime() ?? 0;
  if (expires > Date.now() + 24 * 60 * 60 * 1000) return;

  const db = getDb();
  if (link.watchChannelId && link.watchResourceId) {
    await stopChannel({
      userId: link.userId,
      channelId: link.watchChannelId,
      resourceId: link.watchResourceId,
    });
  }

  const channelToken = newWatchChannelToken();
  const watch = await startFileWatch({
    userId: link.userId,
    fileId: link.googleFileId,
    channelToken,
  });

  await db.googleDocLink.update({
    where: { id: link.id },
    data: {
      watchChannelId: watch.channelId,
      watchResourceId: watch.resourceId,
      watchExpiresAt: watch.expiresAt,
      watchChannelToken: channelToken,
    },
  });
}

export async function runGoogleDocsCron(): Promise<{
  renewed: number;
  reconciled: number;
}> {
  const db = getDb();
  const soon = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const links = await db.googleDocLink.findMany({
    where: {
      OR: [{ watchExpiresAt: null }, { watchExpiresAt: { lt: soon } }],
    },
    take: 50,
  });

  let renewed = 0;
  let reconciled = 0;

  for (const link of links) {
    try {
      await renewWatchIfNeeded(link);
      renewed += 1;
      await reconcileLink(link.id);
      reconciled += 1;
    } catch (e) {
      log.warn("google_docs.cron_link_failed", {
        linkId: link.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { renewed, reconciled };
}
