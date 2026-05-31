import { driveFetch } from "./client";
import { GoogleDriveApiError } from "./client";
import { toGoogleDocHtml } from "./convert";

/** Replace Google Doc content by uploading HTML (Drive converts to Docs). */
export async function updateGoogleDocFromHtml(opts: {
  userId: string;
  fileId: string;
  htmlBody: string;
}): Promise<void> {
  const html = toGoogleDocHtml(opts.htmlBody);
  const res = await driveFetch(
    opts.userId,
    `/files/${encodeURIComponent(opts.fileId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "text/html; charset=UTF-8" },
      body: html,
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new GoogleDriveApiError(
      `Doc update failed ${res.status}`,
      res.status,
      text,
    );
  }
}
