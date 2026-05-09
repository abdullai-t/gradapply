// @ts-nocheck
import { v2 as cloudinary } from "cloudinary";

/** True if `CLOUDINARY_URL` or the three split vars are present. */
export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL?.trim()) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function ensureConfigured(): void {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET (see .env.example).",
    );
  }
  if (process.env.CLOUDINARY_URL?.trim()) {
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
      secure: true,
    });
  }
}

export async function uploadDocumentBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    /** Original filename for friendlier debugging in Cloudinary UI */
    filename?: string;
  },
): Promise<{ secure_url: string; public_id: string }> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: "auto",
        ...(options.filename
          ? {
              use_filename: true,
              filename_override: options.filename.replace(/[^\w.\-]+/g, "_"),
              unique_filename: true,
            }
          : { unique_filename: true }),
      },
      (err, result) => {
        if (err || !result?.secure_url || !result.public_id) {
          reject(err ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );
    stream.end(buffer);
  });
}

/** Best-effort delete when removing a document row. */
export async function destroyStoredAsset(publicId: string): Promise<void> {
  if (!publicId?.trim() || !isCloudinaryConfigured()) return;
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch {
    /* ignore — asset may already be gone */
  }
}
