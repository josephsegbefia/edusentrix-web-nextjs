import type { R2ObjectHead, R2Port } from "@/lib/storage/types";

type StoredObject = {
  body: Uint8Array;
  contentType: string;
  etag: string;
};

export function createMockR2Port(initial: Record<string, StoredObject> = {}): R2Port & {
  objects: Map<string, StoredObject>;
  putCalls: string[];
  deletedKeys: string[];
} {
  const objects = new Map<string, StoredObject>(Object.entries(initial));
  const putCalls: string[] = [];
  const deletedKeys: string[] = [];

  return {
    objects,
    putCalls,
    deletedKeys,
    async createPresignedPut({ key, contentType, expiresInSeconds }) {
      return {
        url: `https://r2.test/presign-put/${encodeURIComponent(key)}`,
        headers: { "Content-Type": contentType },
        expiresInSeconds,
      };
    },
    async createPresignedGet({ key, expiresInSeconds, contentDisposition }) {
      return {
        url: `https://r2.test/presign-get/${encodeURIComponent(key)}?disp=${encodeURIComponent(contentDisposition)}`,
        expiresInSeconds,
      };
    },
    async putObject({ key, body, contentType }) {
      putCalls.push(key);
      objects.set(key, {
        body: body instanceof Buffer ? new Uint8Array(body) : body,
        contentType,
        etag: `"etag-${objects.size + 1}"`,
      });
      return { etag: objects.get(key)?.etag };
    },
    async headObject(key): Promise<R2ObjectHead> {
      const object = objects.get(key);
      if (!object) return { exists: false };
      return {
        exists: true,
        contentType: object.contentType,
        contentLength: object.body.byteLength,
        etag: object.etag,
      };
    },
    async getObjectStream(key) {
      const object = objects.get(key);
      if (!object) {
        return { body: null };
      }
      return {
        body: null,
        contentType: object.contentType,
        contentLength: object.body.byteLength,
      };
    },
    async deleteObject(key) {
      deletedKeys.push(key);
      objects.delete(key);
    },
  };
}
