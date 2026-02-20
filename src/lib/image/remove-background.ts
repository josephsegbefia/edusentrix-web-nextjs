/**
 * Client-side background removal using @imgly/background-removal
 * Runs entirely in the browser using WebAssembly - no API costs!
 * 
 * First use downloads ~5MB WASM model (cached after)
 */

import { removeBackground, Config } from "@imgly/background-removal";

export type BackgroundRemovalProgress = {
  stage: "loading" | "processing" | "done";
  progress: number; // 0-100
  message: string;
};

export type BackgroundRemovalOptions = {
  /** Output format */
  format?: "image/png" | "image/webp";
  /** Quality for webp (0-1) */
  quality?: number;
  /** Background color to apply (default: white) */
  backgroundColor?: string;
  /** Progress callback */
  onProgress?: (progress: BackgroundRemovalProgress) => void;
};

/**
 * Remove background from an image file
 * Returns a new File with transparent or colored background
 */
export async function removeImageBackground(
  file: File,
  options: BackgroundRemovalOptions = {}
): Promise<File> {
  const {
    format = "image/png",
    quality = 0.9,
    backgroundColor = "#FFFFFF",
    onProgress,
  } = options;

  // Configure the background removal
  const config: Config = {
    progress: (key, current, total) => {
      const progress = Math.round((current / total) * 100);
      
      let stage: BackgroundRemovalProgress["stage"] = "processing";
      let message = "Processing...";
      
      if (key === "fetch:weights") {
        stage = "loading";
        message = "Loading AI model...";
      } else if (key === "compute:inference") {
        stage = "processing";
        message = "Removing background...";
      }
      
      onProgress?.({ stage, progress, message });
    },
    output: {
      format: format === "image/webp" ? "image/webp" : "image/png",
      quality,
    },
  };

  try {
    onProgress?.({ stage: "loading", progress: 0, message: "Starting..." });

    // Remove background (returns a Blob)
    const resultBlob = await removeBackground(file, config);

    onProgress?.({ stage: "processing", progress: 80, message: "Applying background color..." });

    // If we want a colored background (not transparent), composite it
    let finalBlob = resultBlob;
    if (backgroundColor && backgroundColor !== "transparent") {
      finalBlob = await applyBackgroundColor(resultBlob, backgroundColor, format, quality);
    }

    onProgress?.({ stage: "done", progress: 100, message: "Done!" });

    // Create a new File with the result
    const extension = format === "image/webp" ? "webp" : "png";
    const newFileName = file.name.replace(/\.[^.]+$/, `.${extension}`);
    
    return new File([finalBlob], newFileName, { type: format });
  } catch (error) {
    console.error("Background removal failed:", error);
    throw new Error("Failed to remove background. Please try again.");
  }
}

/**
 * Apply a solid background color to a transparent image
 */
async function applyBackgroundColor(
  blob: Blob,
  backgroundColor: string,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Fill with background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the image on top
      ctx.drawImage(img, 0, 0);

      // Convert to blob
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Failed to create blob"));
          }
        },
        format,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Check if the browser supports background removal
 * Requires WebAssembly and OffscreenCanvas support
 */
export function isBackgroundRemovalSupported(): boolean {
  return (
    typeof WebAssembly !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

/**
 * Preload the background removal model
 * Call this early to avoid delay on first use
 */
export async function preloadBackgroundRemovalModel(): Promise<void> {
  // Create a tiny 1x1 transparent image
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/png");
  });
  
  const file = new File([blob], "preload.png", { type: "image/png" });
  
  // Process it to trigger model download
  try {
    await removeBackground(file, {
      output: { format: "image/png" },
    });
  } catch {
    // Ignore errors during preload
  }
}
