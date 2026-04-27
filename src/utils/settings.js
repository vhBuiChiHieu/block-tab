/**
 * Auto Block Tab - Shared Settings
 * Dùng chung settings mặc định giữa popup và background
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  nameBlacklist: [],
  suffixBlacklist: [],
  stats: {
    blockedCount: 0,
    lastBlocked: null
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
}
