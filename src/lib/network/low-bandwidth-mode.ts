/**
 * Low Bandwidth Mode
 * Adapts app behavior for slow connections
 */

const STORAGE_KEY = "edusentrix_low_bandwidth_mode";

export type LowBandwidthSettings = {
  enabled: boolean;
  autoDetect: boolean;
  disableAnimations: boolean;
  disableAutoPolling: boolean;
  reducedImageQuality: boolean;
  batchRequests: boolean;
};

const defaultSettings: LowBandwidthSettings = {
  enabled: false,
  autoDetect: true,
  disableAnimations: true,
  disableAutoPolling: true,
  reducedImageQuality: true,
  batchRequests: true,
};

type Listener = (settings: LowBandwidthSettings) => void;

class LowBandwidthManager {
  private settings: LowBandwidthSettings;
  private listeners: Set<Listener> = new Set();
  private autoEnabled = false;

  constructor() {
    this.settings = { ...defaultSettings };
    if (typeof window !== "undefined") {
      this.loadFromStorage();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.settings = { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("Failed to load low bandwidth settings:", e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Failed to save low bandwidth settings:", e);
    }
  }

  private notify() {
    const effectiveSettings = this.getEffectiveSettings();
    this.listeners.forEach((listener) => listener(effectiveSettings));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getEffectiveSettings());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSettings(): LowBandwidthSettings {
    return { ...this.settings };
  }

  getEffectiveSettings(): LowBandwidthSettings {
    // If auto-enabled due to poor connection, merge with settings
    if (this.autoEnabled && this.settings.autoDetect) {
      return { ...this.settings, enabled: true };
    }
    return { ...this.settings };
  }

  isEffectivelyEnabled(): boolean {
    return (
      this.settings.enabled ||
      (this.autoEnabled && this.settings.autoDetect)
    );
  }

  // Called by network health monitor when connection degrades
  setAutoEnabled(enabled: boolean) {
    if (this.autoEnabled !== enabled) {
      this.autoEnabled = enabled;
      if (this.settings.autoDetect) {
        this.notify();
      }
    }
  }

  // User toggles low bandwidth mode
  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.saveToStorage();
    this.notify();
  }

  // Toggle auto-detect
  setAutoDetect(autoDetect: boolean) {
    this.settings.autoDetect = autoDetect;
    this.saveToStorage();
    this.notify();
  }

  // Update individual settings
  updateSettings(partial: Partial<LowBandwidthSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.saveToStorage();
    this.notify();
  }

  // Reset to defaults
  reset() {
    this.settings = { ...defaultSettings };
    this.autoEnabled = false;
    this.saveToStorage();
    this.notify();
  }
}

// Singleton instance
export const lowBandwidthManager =
  typeof window !== "undefined" ? new LowBandwidthManager() : null;

export function getLowBandwidthManager(): LowBandwidthManager | null {
  return lowBandwidthManager;
}
