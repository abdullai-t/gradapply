import { driveFetch } from "./client";
import { GoogleDriveApiError } from "./client";
import { toGradApplyHtml } from "./convert";

export async function exportGoogleDocAsGradApplyHtml(
  userId: string,
  fileId: string,
): Promise<string> {
  const res = await driveFetch(
    userId,
    `/files/${encodeURIComponent(fileId)}/export?mimeType=text/html`,
  );
  const html = await res.text();
  if (!res.ok) {
    throw new GoogleDriveApiError(
      `Export failed ${res.status}`,
      res.status,
      html,
    );
  }
  return toGradApplyHtml(html);
}

export type DriveFileMeta = {
  id: string;
  headRevisionId?: string;
  modifiedTime?: string;
};

export async function getDriveFileMeta(
  userId: string,
  fileId: string,
): Promise<DriveFileMeta> {
  const { driveJson } = await import("./client");
  return driveJson<DriveFileMeta>(
    userId,
    `/files/${encodeURIComponent(fileId)}?fields=id,headRevisionId,modifiedTime`,
  );
}
