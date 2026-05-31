import { ensureFreshDriveAccess } from "@/lib/google-drive-connector";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DOCS_API = "https://docs.googleapis.com/v1";

export { DRIVE_API, DOCS_API };

export class GoogleDriveApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "GoogleDriveApiError";
  }
}

export async function driveFetch(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { accessToken } = await ensureFreshDriveAccess(userId);
  const url = path.startsWith("http") ? path : `${DRIVE_API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function driveJson<T>(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await driveFetch(userId, path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new GoogleDriveApiError(
      `Drive API ${res.status}: ${text.slice(0, 300)}`,
      res.status,
      text,
    );
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
