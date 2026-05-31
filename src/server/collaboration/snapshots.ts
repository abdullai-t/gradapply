import type { CollaborationArtifactType } from "@prisma/client";

import { getDb } from "@/lib/prisma";

export type ArtifactSnapshot = {
  body: string;
  title?: string;
  emailSubject?: string;
  profName?: string;
};

export async function buildArtifactSnapshot(opts: {
  userId: string;
  artifactType: CollaborationArtifactType;
  entityId?: string;
  customBody?: string;
  customTitle?: string;
}): Promise<{
  snapshot: ArtifactSnapshot;
  title: string;
  schoolId: string | null;
  sourceEntityId: string | null;
}> {
  if (opts.artifactType === "CUSTOM_TEXT") {
    const body = opts.customBody?.trim() ?? "";
    if (!body) throw new Error("customBody required for CUSTOM_TEXT");
    const title = opts.customTitle?.trim() || "Shared draft";
    return {
      snapshot: { body, title },
      title,
      schoolId: null,
      sourceEntityId: null,
    };
  }

  if (!opts.entityId?.trim()) {
    throw new Error("entityId required");
  }

  if (opts.artifactType === "SOP_VARIANT") {
    const variant = await getDb().sopVariant.findFirst({
      where: { id: opts.entityId, userId: opts.userId },
      include: { school: { select: { id: true, name: true, program: true } } },
    });
    if (!variant) throw new Error("SOP variant not found");
    const title =
      opts.customTitle?.trim() ||
      `SOP review — ${variant.school.name} (${variant.school.program})`;
    return {
      snapshot: {
        body: variant.body,
        title: variant.title,
      },
      title,
      schoolId: variant.schoolId,
      sourceEntityId: variant.id,
    };
  }

  const email = await getDb().profEmail.findFirst({
    where: { id: opts.entityId, userId: opts.userId },
  });
  if (!email) throw new Error("Professor email not found");

  const title =
    opts.customTitle?.trim() ||
    `Email review — ${email.profName?.trim() || email.university?.trim() || "Outreach draft"}`;

  return {
    snapshot: {
      body: email.emailBody?.trim() ?? "",
      emailSubject: email.emailSubject?.trim() ?? undefined,
      profName: email.profName?.trim() ?? undefined,
      title,
    },
    title,
    schoolId: null,
    sourceEntityId: email.id,
  };
}

export async function refreshSnapshotFromSource(opts: {
  userId: string;
  artifactType: CollaborationArtifactType;
  sourceEntityId: string | null;
}): Promise<ArtifactSnapshot> {
  if (!opts.sourceEntityId) {
    throw new Error("No linked source entity");
  }
  const built = await buildArtifactSnapshot({
    userId: opts.userId,
    artifactType: opts.artifactType,
    entityId: opts.sourceEntityId,
  });
  return built.snapshot;
}
