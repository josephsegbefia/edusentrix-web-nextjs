"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { LessonNoteFormData } from "@/types/lesson-notes";

// ============================================================================
// Types
// ============================================================================

export interface DraftMeta {
  key: string;
  topic: string;
  classGroupId: string;
  templateType: string;
  lastSaved: string;
}

interface StoredDraft {
  formData: LessonNoteFormData;
  meta: DraftMeta;
}

// ============================================================================
// Constants
// ============================================================================

const DRAFT_KEY_PREFIX = "edusentrix_lesson_note_draft_";
const DRAFT_INDEX_KEY = "edusentrix_lesson_note_drafts_index";
const AUTO_SAVE_DELAY_MS = 3000; // 3 seconds
const MAX_DRAFTS = 10; // Maximum number of drafts to keep

// ============================================================================
// Utilities
// ============================================================================

function generateDraftKey(classGroupId: string, existingId?: string): string {
  if (existingId) {
    return `${DRAFT_KEY_PREFIX}edit_${existingId}`;
  }
  return `${DRAFT_KEY_PREFIX}new_${classGroupId}_${Date.now()}`;
}

function getDraftIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(DRAFT_INDEX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveDraftIndex(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(keys));
  } catch {
    // Storage full or unavailable
  }
}

function addToDraftIndex(key: string): void {
  const index = getDraftIndex();
  // Remove if already exists (will be re-added at end)
  const filtered = index.filter((k) => k !== key);
  filtered.push(key);
  
  // Trim to max drafts
  while (filtered.length > MAX_DRAFTS) {
    const removed = filtered.shift();
    if (removed && typeof window !== "undefined") {
      try {
        localStorage.removeItem(removed);
      } catch {
        // Ignore
      }
    }
  }
  
  saveDraftIndex(filtered);
}

function removeFromDraftIndex(key: string): void {
  const index = getDraftIndex();
  saveDraftIndex(index.filter((k) => k !== key));
}

// ============================================================================
// Hook: useLessonNoteDraftPersistence
// ============================================================================

export function useLessonNoteDraftPersistence(
  formData: LessonNoteFormData,
  options?: {
    existingId?: string;
    enabled?: boolean;
    onRestored?: (draft: LessonNoteFormData) => void;
  }
) {
  const { existingId, enabled = true, onRestored } = options || {};
  
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Initialize draft key
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    
    const key = generateDraftKey(formData.classGroupId, existingId);
    setDraftKey(key);
    
    // Check for existing draft
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const draft: StoredDraft = JSON.parse(stored);
        setLastSaved(new Date(draft.meta.lastSaved));
        // Don't auto-restore, let user decide
      }
    } catch {
      // Ignore parse errors
    }
    
    return () => {
      // Save on unmount if there are pending changes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveDraftImmediately();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId, enabled]);

  // Save draft immediately
  const saveDraftImmediately = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return false;
    
    try {
      const draft: StoredDraft = {
        formData: formDataRef.current,
        meta: {
          key: draftKey,
          topic: formDataRef.current.topic || "Untitled",
          classGroupId: formDataRef.current.classGroupId,
          templateType: formDataRef.current.templateType,
          lastSaved: new Date().toISOString(),
        },
      };
      
      localStorage.setItem(draftKey, JSON.stringify(draft));
      addToDraftIndex(draftKey);
      setLastSaved(new Date());
      setHasPendingChanges(false);
      return true;
    } catch (error) {
      console.error("Failed to save draft:", error);
      return false;
    }
  }, [draftKey]);

  // Schedule auto-save with debounce
  const scheduleSave = useCallback(() => {
    if (!enabled) return;
    
    setHasPendingChanges(true);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftImmediately();
    }, AUTO_SAVE_DELAY_MS);
  }, [enabled, saveDraftImmediately]);

  // Trigger save when formData changes
  useEffect(() => {
    if (!enabled || !draftKey) return;
    scheduleSave();
  }, [formData, enabled, draftKey, scheduleSave]);

  // Restore draft
  const restoreDraft = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return null;
    
    setIsRestoring(true);
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft: StoredDraft = JSON.parse(stored);
        onRestored?.(draft.formData);
        setIsRestoring(false);
        return draft.formData;
      }
    } catch {
      // Ignore parse errors
    }
    setIsRestoring(false);
    return null;
  }, [draftKey, onRestored]);

  // Delete draft
  const deleteDraft = useCallback(() => {
    if (!draftKey || typeof window === "undefined") return;
    
    try {
      localStorage.removeItem(draftKey);
      removeFromDraftIndex(draftKey);
      setLastSaved(null);
      setHasPendingChanges(false);
    } catch {
      // Ignore
    }
  }, [draftKey]);

  // Force save now
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    return saveDraftImmediately();
  }, [saveDraftImmediately]);

  return {
    draftKey,
    lastSaved,
    hasPendingChanges,
    isRestoring,
    saveDraftImmediately: saveNow,
    restoreDraft,
    deleteDraft,
  };
}

// ============================================================================
// Hook: useAvailableDrafts
// ============================================================================

export function useAvailableDrafts() {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const index = getDraftIndex();
    const draftMetas: DraftMeta[] = [];
    
    for (const key of index) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const draft: StoredDraft = JSON.parse(stored);
          draftMetas.push(draft.meta);
        }
      } catch {
        // Remove invalid entries
        removeFromDraftIndex(key);
      }
    }
    
    // Sort by last saved, newest first
    draftMetas.sort((a, b) => 
      new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime()
    );
    
    setDrafts(draftMetas);
  }, []);

  const loadDraft = useCallback((key: string): LessonNoteFormData | null => {
    if (typeof window === "undefined") return null;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const draft: StoredDraft = JSON.parse(stored);
        return draft.formData;
      }
    } catch {
      // Ignore
    }
    return null;
  }, []);

  const removeDraft = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    
    try {
      localStorage.removeItem(key);
      removeFromDraftIndex(key);
      setDrafts((prev) => prev.filter((d) => d.key !== key));
    } catch {
      // Ignore
    }
  }, []);

  const clearAllDrafts = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const index = getDraftIndex();
    for (const key of index) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }
    saveDraftIndex([]);
    setDrafts([]);
  }, []);

  return {
    drafts,
    loadDraft,
    removeDraft,
    clearAllDrafts,
  };
}
