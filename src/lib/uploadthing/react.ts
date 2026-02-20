"use client";

import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "./core";

export const { useUploadThing, uploadFiles, getRouteConfig } =
  generateReactHelpers<OurFileRouter>();
