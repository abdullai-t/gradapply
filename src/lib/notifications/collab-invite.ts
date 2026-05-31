import { buildCollabInviteEmail } from "@/lib/email/templates/collab-invite";
import type { SendNotificationResult } from "@/lib/notifications/send";
import { sendNotification } from "@/lib/notifications/send";
import type { NotificationRecipient } from "@/lib/notifications/send";

export async function sendCollabInviteEmail(opts: {
  invitee: NotificationRecipient;
  ownerName: string;
  sessionTitle: string;
  sessionId: string;
}): Promise<SendNotificationResult> {
  if (!opts.invitee.email?.trim()) {
    return { status: "skipped", reason: "no_email" };
  }

  const content = buildCollabInviteEmail({
    ownerName: opts.ownerName,
    sessionTitle: opts.sessionTitle,
    sessionId: opts.sessionId,
    inviteeName: opts.invitee.name,
  });

  const dedupeKey = `collab_invite:${opts.sessionId}:${opts.invitee.id}`;

  return sendNotification({
    userId: opts.invitee.id,
    type: "COLLAB_INVITE",
    dedupeKey,
    to: opts.invitee.email.trim().toLowerCase(),
    content,
  });
}
