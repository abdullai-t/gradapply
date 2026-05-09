// @ts-nocheck
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
function requireEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required env var: ${name}`);
    return v;
}
export function getBucketName() {
    return (process.env.AWS_S3_BUCKET ||
        process.env.S3_BUCKET ||
        process.env.S3_BUCKET_NAME ||
        "");
}
/** Enough env for server-side upload / delete (presign uses this implicitly). */
export function isS3UploadConfigured() {
    return Boolean(getBucketName().trim() &&
        process.env.AWS_ACCESS_KEY_ID?.trim() &&
        process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
        process.env.AWS_REGION?.trim());
}
export function getS3Client() {
    return new S3Client({
        region: requireEnv("AWS_REGION"),
        credentials: {
            accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
        },
    });
}
function publicObjectUrl(bucket, key) {
    const base = process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
        process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
        `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    const safeKey = key
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/");
    return `${base}/${safeKey}`;
}
export async function uploadObject(params) {
    const bucket = getBucketName() || requireEnv("AWS_S3_BUCKET");
    const client = getS3Client();
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
    }));
    return publicObjectUrl(bucket, params.key);
}
export async function deleteObject(key) {
    const bucket = getBucketName() || requireEnv("AWS_S3_BUCKET");
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    }));
}
const DEFAULT_GET_MAX_BYTES = 6 * 1024 * 1024;
/**
 * Read an object using bucket credentials (for private buckets).
 * Only keys stored by this app (`users/...`) are accepted.
 */
export async function getObjectBuffer(key, maxBytes = DEFAULT_GET_MAX_BYTES) {
    if (!isS3UploadConfigured())
        return null;
    const trimmed = key?.trim() ?? "";
    if (!trimmed.startsWith("users/"))
        return null;
    try {
        const bucket = getBucketName() || requireEnv("AWS_S3_BUCKET");
        const client = getS3Client();
        const res = await client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: trimmed,
        }));
        const body = res.Body;
        if (!body)
            return null;
        const bytes = await body.transformToByteArray();
        if (bytes.byteLength === 0 || bytes.byteLength > maxBytes)
            return null;
        return Buffer.from(bytes);
    }
    catch {
        return null;
    }
}
export async function presignPut({ userId, filename, contentType, }) {
    const bucket = getBucketName();
    if (!bucket) {
        throw new Error("S3 bucket not configured (AWS_S3_BUCKET or S3_BUCKET_NAME).");
    }
    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const key = `users/${userId}/${randomUUID()}-${safeName}`;
    const client = getS3Client();
    const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 3600 });
    const url = publicObjectUrl(bucket, key);
    return { uploadUrl, key, url };
}
