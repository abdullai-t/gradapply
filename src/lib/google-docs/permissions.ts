import { driveJson } from "./client";

export async function shareGoogleDocWithEmail(opts: {
  userId: string;
  fileId: string;
  email: string;
  role?: "writer" | "commenter" | "reader";
}): Promise<void> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return;

  await driveJson(
    opts.userId,
    `/files/${encodeURIComponent(opts.fileId)}/permissions?sendNotificationEmail=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user",
        role: opts.role ?? "writer",
        emailAddress: email,
      }),
    },
  );
}
