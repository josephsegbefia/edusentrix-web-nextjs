import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Config } from "./config";
import {
  StorageProviderError,
  type R2ObjectHead,
  type R2Port,
} from "./types";

let client: S3Client | null = null;
let injectedPort: R2Port | null = null;

function getS3Client(): S3Client {
  if (client) return client;
  const config = getR2Config();
  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

function safeProviderError(error: unknown): StorageProviderError {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: string }).name)
      : "R2Error";
  if (name === "NotFound" || name === "NotFoundError" || name === "NoSuchKey") {
    return new StorageProviderError("Object not found");
  }
  return new StorageProviderError("Storage provider request failed");
}

export function createR2Port(): R2Port {
  return {
    async createPresignedPut({ key, contentType, expiresInSeconds }) {
      try {
        const config = getR2Config();
        const command = new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType,
        });
        const url = await getSignedUrl(getS3Client(), command, {
          expiresIn: expiresInSeconds,
        });
        return {
          url,
          headers: { "Content-Type": contentType },
          expiresInSeconds,
        };
      } catch (error) {
        throw safeProviderError(error);
      }
    },

    async createPresignedGet({
      key,
      expiresInSeconds,
      contentDisposition,
      contentType,
    }) {
      try {
        const config = getR2Config();
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ResponseContentDisposition: contentDisposition,
          ResponseContentType: contentType,
        });
        const url = await getSignedUrl(getS3Client(), command, {
          expiresIn: expiresInSeconds,
        });
        return { url, expiresInSeconds };
      } catch (error) {
        throw safeProviderError(error);
      }
    },

    async putObject({ key, body, contentType }) {
      try {
        const config = getR2Config();
        const result = await getS3Client().send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
          })
        );
        return { etag: result.ETag };
      } catch (error) {
        throw safeProviderError(error);
      }
    },

    async headObject(key): Promise<R2ObjectHead> {
      try {
        const config = getR2Config();
        const result = await getS3Client().send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
          })
        );
        return {
          exists: true,
          contentType: result.ContentType,
          contentLength: result.ContentLength,
          etag: result.ETag,
        };
      } catch (error) {
        const name =
          error && typeof error === "object" && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        const status =
          error && typeof error === "object" && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode
            : undefined;
        if (name === "NotFound" || name === "NotFoundError" || status === 404) {
          return { exists: false };
        }
        throw safeProviderError(error);
      }
    },

    async getObjectStream(key) {
      try {
        const config = getR2Config();
        const result = await getS3Client().send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: key,
          })
        );
        return {
          body: (result.Body as AsyncIterable<Uint8Array> | null) ?? null,
          contentType: result.ContentType,
          contentLength: result.ContentLength,
        };
      } catch (error) {
        throw safeProviderError(error);
      }
    },

    async deleteObject(key) {
      try {
        const config = getR2Config();
        await getS3Client().send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: key,
          })
        );
      } catch (error) {
        throw safeProviderError(error);
      }
    },
  };
}

export function setR2PortForTests(port: R2Port | null): void {
  injectedPort = port;
}

export function resetR2Client(): void {
  client = null;
}

export function getR2Port(): R2Port {
  return injectedPort ?? createR2Port();
}
