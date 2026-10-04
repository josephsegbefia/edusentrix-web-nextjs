import { StorageValidationError } from "./types";

export const OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;
export const ASSET_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertObjectIdHex(value: string, label = "id"): string {
  if (!OBJECT_ID_HEX.test(value)) {
    throw new StorageValidationError(`Invalid ${label}`);
  }
  return value.toLowerCase();
}
