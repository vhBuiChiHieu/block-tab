/**
 * Auto Block Tab - Logger Module
 * Ghi log WARNING/ERROR và lịch sử tab đã chặn
 * Lưu vào chrome.storage.local để có thể export/submit sau này
 * @version 1.1.0
 */

const Logger = (() => {
  // Config
  const MAX_LOGS = 100; // Giới hạn số log lưu trữ
  const MAX_RECENT_BLOCKED = 50;
  const STORAGE_KEY = 'autoBlockTab_logs';
  const RECENT_BLOCKED_KEY = 'autoBlockTab_recentBlocked';

  // Log levels
  const LEVEL = {
    WARN: 'WARN',
    ERROR: 'ERROR'
  };

  let logsCache = [];
  let loadPromise = null;
  let savePromise = null;
  let recentBlockedMutationPromise = Promise.resolve();
  let isLoaded = false;
  let mutationVersion = 0;
  let savedVersion = 0;

  /**
   * Load logs từ storage vào cache
   */
  async function loadFromStorage() {
    if (isLoaded) {
      return;
    }

    if (!loadPromise) {
      loadPromise = chrome.storage.local.get(STORAGE_KEY)
        .then((result) => {
          logsCache = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
          isLoaded = true;
        })
        .catch((e) => {
          console.error('[Logger] Failed to load logs:', e);
          logsCache = [];
          isLoaded = false;
        })
        .finally(() => {
          loadPromise = null;
        });
    }

    await loadPromise;
  }

  /**
   * Persist logs cache vào storage
   */
  async function saveToStorage() {
    while (savedVersion < mutationVersion) {
      if (!savePromise) {
        const snapshot = [...logsCache];
        const targetVersion = mutationVersion;
        savePromise = chrome.storage.local.set({ [STORAGE_KEY]: snapshot })
          .then(() => {
            savedVersion = Math.max(savedVersion, targetVersion);
          })
          .catch((e) => {
            console.error('[Logger] Failed to save logs:', e);
            throw e;
          })
          .finally(() => {
            savePromise = null;
          });
      }

      await savePromise;
    }
  }

  /**
   * Thêm log entry mới
   * @param {string} level - WARN hoặc ERROR
   * @param {string} message - Nội dung log
   * @param {any} [data] - Dữ liệu bổ sung (optional)
   */
  async function addLog(level, message, data = null) {
    await loadFromStorage();

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data) : null
    };

    logsCache.push(entry);

    if (logsCache.length > MAX_LOGS) {
      logsCache = logsCache.slice(-MAX_LOGS);
    }

    mutationVersion += 1;

    const consoleMethod = level === LEVEL.ERROR ? 'error' : 'warn';
    console[consoleMethod](`[AutoBlockTab] ${message}`, data || '');

    await saveToStorage();
  }

  /**
   * Log warning
   * @param {string} message 
   * @param {any} [data]
   */
  async function warn(message, data) {
    await addLog(LEVEL.WARN, message, data);
  }

  /**
   * Log error
   * @param {string} message 
   * @param {any} [data]
   */
  async function error(message, data) {
    await addLog(LEVEL.ERROR, message, data);
  }

  /**
   * Lấy tất cả logs
   * @returns {Promise<Array>}
   */
  async function getLogs() {
    await loadFromStorage();
    return [...logsCache];
  }

  /**
   * Xóa tất cả logs
   * @returns {Promise<void>}
   */
  async function clearLogs() {
    await loadFromStorage();
    logsCache = [];
    mutationVersion += 1;
    await saveToStorage();
  }

  async function addRecentBlocked(entry) {
    const nextMutation = recentBlockedMutationPromise.then(async () => {
      const result = await chrome.storage.local.get({ [RECENT_BLOCKED_KEY]: [] });
      const entries = Array.isArray(result[RECENT_BLOCKED_KEY]) ? result[RECENT_BLOCKED_KEY] : [];
      entries.unshift(entry);
      await chrome.storage.local.set({
        [RECENT_BLOCKED_KEY]: entries.slice(0, MAX_RECENT_BLOCKED)
      });
    });

    recentBlockedMutationPromise = nextMutation.catch(() => {});
    await nextMutation;
  }

  async function getRecentBlocked() {
    const result = await chrome.storage.local.get({ [RECENT_BLOCKED_KEY]: [] });
    return Array.isArray(result[RECENT_BLOCKED_KEY]) ? result[RECENT_BLOCKED_KEY] : [];
  }

  async function clearRecentBlocked() {
    await chrome.storage.local.set({ [RECENT_BLOCKED_KEY]: [] });
  }

  /**
   * Export logs thành string để download/submit
   * @returns {Promise<string>}
   */
  async function exportLogs() {
    const logs = await getLogs();
    const header = `=== Auto Block Tab Logs ===
Exported: ${new Date().toISOString()}
Total Entries: ${logs.length}
${'='.repeat(30)}

`;
    
    const content = logs.map(log => {
      let line = `[${log.timestamp}] [${log.level}] ${log.message}`;
      if (log.data) {
        line += `\n    Data: ${log.data}`;
      }
      return line;
    }).join('\n');

    return header + content;
  }

  /**
   * Chuẩn bị payload để gửi lên server (cho tính năng sau này)
   * @returns {Promise<Object>}
   */
  async function getSubmitPayload() {
    const logs = await getLogs();
    return {
      extensionVersion: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      logs
    };
  }

  // Load logs khi init
  loadFromStorage();

  // Public API
  return {
    warn,
    error,
    getLogs,
    clearLogs,
    addRecentBlocked,
    getRecentBlocked,
    clearRecentBlocked,
    exportLogs,
    getSubmitPayload,
    // Force save (gọi trước khi service worker bị terminate)
    flush: saveToStorage
  };
})();

// Export cho service worker
if (typeof globalThis !== 'undefined') {
  globalThis.Logger = Logger;
}
