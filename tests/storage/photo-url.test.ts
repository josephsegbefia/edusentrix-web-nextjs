import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { optionalPhotoUrlSchema, isAcceptablePhotoUrl } from "@/schemas/photoUrl";

const OBJECT_ID = "64b7f0c2a1d2e3f405060708";
const OBJECT_NAME = "620fbbf2-8594-4c68-884d-c9fb5e9c2aa3.png";
const STORAGE_KEY = `schools/${OBJECT_ID}/pending/student_avatar/${OBJECT_NAME}`;

describe("photo URL acceptance", () => {
  test("accepts blank, internal asset paths, legacy URLs, storage keys, and object names", () => {
    const accepted = [
      "",
      "   ",
      `/api/storage/assets/${OBJECT_ID}`,
      `https://tryedusentrix.app/api/storage/assets/${OBJECT_ID}?disposition=inline`,
      "https://res.cloudinary.com/demo/image/upload/v1/photo.jpg",
      STORAGE_KEY,
      OBJECT_NAME,
      "620fbbf2-8594-4c68-884d-c9fb5e9c2aa3.jpeg",
      "620fbbf2-8594-4c68-884d-c9fb5e9c2aa3.webp",
    ];

    for (const value of accepted) {
      assert.equal(isAcceptablePhotoUrl(value), true, value);
      assert.equal(optionalPhotoUrlSchema.safeParse(value).success, true, value);
    }

    assert.equal(optionalPhotoUrlSchema.safeParse(null).success, true);
    assert.equal(optionalPhotoUrlSchema.safeParse(undefined).success, true);
  });

  test("rejects data URLs, blob URLs, and unrelated strings", () => {
    const rejected = [
      "data:image/png;base64,AAAA",
      "blob:http://localhost:3000/620fbbf2-8594-4c68-884d-c9fb5e9c2aa3",
      "not a photo",
      "photo.png",
      `javascript:alert(${OBJECT_NAME})`,
      `schools/not-a-school/${OBJECT_NAME}`,
    ];

    for (const value of rejected) {
      assert.equal(isAcceptablePhotoUrl(value), false, value);
      const parsed = optionalPhotoUrlSchema.safeParse(value);
      assert.equal(parsed.success, false, value);
      if (!parsed.success) {
        assert.equal(parsed.error.issues[0]?.message, "Invalid photo URL");
      }
    }
  });
});
