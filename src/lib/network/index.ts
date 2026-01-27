/**
 * Network Utilities Index
 * Re-exports all network-related utilities for easy imports
 */

// Offline Queue
export {
  offlineQueue,
  getOfflineQueue,
  type QueuedMutation,
  type QueueStatus,
} from "./offline-queue";

// SSE Manager
export {
  sseManager,
  getSSEManager,
  type SSEConnectionState,
  type SSEStatusEvent,
} from "./sse-manager";

// Connection History
export {
  connectionHistory,
  getConnectionHistory,
  type ConnectionEvent,
} from "./connection-history";

// Low Bandwidth Mode
export {
  lowBandwidthManager,
  getLowBandwidthManager,
  type LowBandwidthSettings,
} from "./low-bandwidth-mode";
