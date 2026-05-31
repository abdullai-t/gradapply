import { driveJson } from "./client";
import { toGoogleDocHtml } from "./convert";

type DriveFile = {
  id: string;
  name?: string;
  webViewLink?: string;
  headRevisionId?: string;
  modifiedTime?: string;
};

export async function createGoogleDocFromHtml(opts: {
  userId: string;
  title: string;
  htmlBody: string;
}): Promise<{
  fileId: string;
  docUrl: string;
  headRevisionId: string | null;
  modifiedTime: Date | null;
}> {
  const html = toGoogleDocHtml(opts.htmlBody);
  const metadata = {
    name: opts.title.slice(0, 200),
    mimeType: "application/vnd.google-apps.document",
  };

  const boundary = `gradapply_${Date.now()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${boundary}--`,
  ].join("\r\n");

  const file = await driveJson<DriveFile>(opts.userId, "/files?fields=id,name,webViewLink,headRevisionId,modifiedTime", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const fileId = file.id;
  const docUrl =
    file.webViewLink ??
    `https://docs.google.com/document/d/${fileId}/edit`;

  return {
    fileId,
    docUrl,
    headRevisionId: file.headRevisionId ?? null,
    modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
  };
}
