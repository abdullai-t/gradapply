import { NextResponse } from "next/server";

import { GoogleDriveApiError } from "@/lib/google-docs";
import {
  createLinkForEntity,
  deleteLinkForEntity,
  serializeLink,
} from "@/lib/google-docs";
import { hasGoogleDocsSyncScopes } from "@/lib/google-drive-connector";
import { ConnectorProvider } from "@prisma/client";
import { getDb } from "@/lib/prisma";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { bad, notFound, ok } from "@/server/_responses";
import { withAuth } from "@/server/_with-auth";

import { linkBodySchema } from "./schemas";

async function assertDriveConnected(userId: string): Promise<NextResponse | null> {
  const locked = await requireNonFreeForFeature(userId, "connectors");
  if (locked) return locked;

  const db = getDb();
  const row = await db.connector.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: ConnectorProvider.GOOGLE_DRIVE,
      },
    },
  });
  if (!row) {
    return NextResponse.json(
      {
        code: "GOOGLE_DRIVE_NOT_CONNECTED",
        error: "Connect Google Drive in Settings to use Google Docs sync.",
      },
      { status: 400 },
    );
  }
  if (!hasGoogleDocsSyncScopes(row.scopes)) {
    return NextResponse.json(
      {
        code: "GOOGLE_DRIVE_RECONNECT_REQUIRED",
        error:
          "Reconnect Google Drive in Settings to grant Docs editing permissions.",
      },
      { status: 400 },
    );
  }
  return null;
}

export const getLink = withAuth(async (req, { userId }) => {
  const gate = await assertDriveConnected(userId);
  if (gate) return gate;

  const url = new URL(req.url);
  const parsed = linkBodySchema.safeParse({
    entityType: url.searchParams.get("entityType"),
    entityId: url.searchParams.get("entityId"),
  });
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const db = getDb();
  const link = await db.googleDocLink.findFirst({
    where: {
      userId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
    },
  });

  if (!link) return ok({ link: null });
  return ok({ link: serializeLink(link) });
});

export const createLink = withAuth(async (req, { userId }) => {
  const gate = await assertDriveConnected(userId);
  if (gate) return gate;

  const json = await req.json().catch(() => null);
  const parsed = linkBodySchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  try {
    const link = await createLinkForEntity({
      userId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
    });
    return ok({ link: serializeLink(link) }, { status: 201 });
  } catch (e) {
    if (e instanceof GoogleDriveApiError && e.status === 403) {
      return NextResponse.json(
        {
          code: "GOOGLE_DRIVE_RECONNECT_REQUIRED",
          error:
            "Reconnect Google Drive in Settings to grant Docs editing permissions.",
        },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : "link_failed";
    if (message === "not_found") return notFound();
    if (message === "document_not_text" || message === "document_requires_extract") {
      return bad(
        "Google Docs sync is only available for SOP variants and professor emails.",
      );
    }
    return bad(message);
  }
});

export const removeLink = withAuth(async (req, { userId }) => {
  const gate = await assertDriveConnected(userId);
  if (gate) return gate;

  const json = await req.json().catch(() => null);
  const parsed = linkBodySchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  await deleteLinkForEntity(
    userId,
    parsed.data.entityType,
    parsed.data.entityId,
  );
  return ok({ removed: true });
});
