/**
 * Hook for processing images with optional background removal
 * 
 * Currently handles background removal client-side.
 * Once UploadThing is installed, this will be extended to handle uploads too.
 * 
 * @see UPLOADTHING_MIGRATION_PLAN.md for integration details
 */
"use client";

import { useState, useCallback } from "react";
import {
  removeImageBackground,
  isBackgroundRemovalSupported,
  type BackgroundRemovalProgress,
} from "@/lib/image/remove-background";

export type ProcessingStage =
  | "idle"
  | "removing-background"
  | "done"
  | "error";

export type ProcessingProgress = {
  stage: ProcessingStage;
  progress: number; // 0-100
  message: string;
};

export type UseImageProcessingOptions = {
  /** Whether to remove background (default: true) */
  removeBackground?: boolean;
  /** Background color after removal (default: white) */
  backgroundColor?: string;
  /** Output format */
  format?: "image/png" | "image/webp";
  /** Callback when processing completes */
  onComplete?: (processedFile: File, previewUrl: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
};

/**
 * Hook for client-side image processing (background removal)
 * 
 * Usage:
 * ```tsx
 * const { processImage, progress, preview, isProcessing } = useImageProcessing({
 *   removeBackground: true,
 *   onComplete: (file, previewUrl) => {
 *     // Upload the processed file
 *     uploadToServer(file);
 *   }
 * });
 * 
 * <input type="file" onChange={(e) => e.target.files?.[0] && processImage(e.target.files[0])} />
 * {preview && <img src={preview} />}
 * ```
 */
export function useImageProcessing(options: UseImageProcessingOptions = {}) {
  const {
    removeBackground: shouldRemoveBg = true,
    backgroundColor = "#FFFFFF",
    format = "image/png",
    onComplete,
    onError,
  } = options;

  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: "idle",
    progress: 0,
    message: "",
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);

  const processImage = useCallback(
    async (file: File) => {
      try {
        // Reset state
        setProcessedFile(null);
        setProgress({ stage: "idle", progress: 0, message: "Starting..." });

        // Create local preview immediately
        const originalPreview = URL.createObjectURL(file);
        setPreview(originalPreview);

        let resultFile = file;

        // Remove background if enabled and supported
        if (shouldRemoveBg && isBackgroundRemovalSupported()) {
          setProgress({
            stage: "removing-background",
            progress: 0,
            message: "Loading AI model...",
          });

          resultFile = await removeImageBackground(file, {
            backgroundColor,
            format,
            onProgress: (bgProgress: BackgroundRemovalProgress) => {
              setProgress({
                stage: "removing-background",
                progress: bgProgress.progress,
                message: bgProgress.message,
              });
            },
          });

          // Update preview with processed image
          URL.revokeObjectURL(originalPreview);
          const processedPreview = URL.createObjectURL(resultFile);
          setPreview(processedPreview);
        }

        setProcessedFile(resultFile);
        setProgress({ stage: "done", progress: 100, message: "Done!" });
        
        // Get the final preview URL
        const finalPreview = URL.createObjectURL(resultFile);
        onComplete?.(resultFile, finalPreview);
        
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Processing failed");
        setProgress({ stage: "error", progress: 0, message: err.message });
        onError?.(err);
      }
    },
    [shouldRemoveBg, backgroundColor, format, onComplete, onError]
  );

  const reset = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setProgress({ stage: "idle", progress: 0, message: "" });
    setPreview(null);
    setProcessedFile(null);
  }, [preview]);

  return {
    /** Process an image (with optional background removal) */
    processImage,
    /** Reset state */
    reset,
    /** Current progress */
    progress,
    /** Preview URL (revoked on reset) */
    preview,
    /** Processed file (ready for upload) */
    processedFile,
    /** Whether currently processing */
    isProcessing: progress.stage === "removing-background",
    /** Whether background removal is supported in this browser */
    isBackgroundRemovalSupported: isBackgroundRemovalSupported(),
  };
}

// Re-export for convenience
export { isBackgroundRemovalSupported, removeImageBackground } from "@/lib/image/remove-background";
