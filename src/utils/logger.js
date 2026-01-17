/**
 * Auto Block Tab - Logger Module
 * Chỉ ghi log WARNING và ERROR
 * Lưu vào chrome.storage.local để có thể export/submit sau này
 * @version 1.0.0
 */

const Logger = (() => {
  // Config
  const MAX_LOGS = 100; // Giới hạn số log lưu trữ
  const STORAGE_KEY = 'autoBlockTab_logs';

  // Log levels
  const LEVEL = {
    WARN: 'WARN',
    ERROR: 'ERROR'
  };

  // In-memory cache (sync với storage định kỳ)
  let logsCache = [];
  let isDirty = false;

  /**
   * Load logs từ storage vào cache
   */
  async function loadFromStorage() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      logsCache = result[STORAGE_KEY] || [];
    } catch (e) {
      console.error('[Logger] Failed to load logs:', e);
      logsCache = [];
    }
  }

  /**
   * Persist logs cache vào storage
   */
  async function saveToStorage() {
    if (!isDirty) return;
    
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: logsCache });
      isDirty = false;
    } catch (e) {
      console.error('[Logger] Failed to save logs:', e);
    }
  }

  /**
   * Thêm log entry mới
   * @param {string} level - WARN hoặc ERROR
   * @param {string} message - Nội dung log
   * @param {any} [data] - Dữ liệu bổ sung (optional)
   */
  function addLog(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data) : null
    };

    // Thêm vào cache
    logsCache.push(entry);

    // Giới hạn số log
    if (logsCache.length > MAX_LOGS) {
      logsCache = logsCache.slice(-MAX_LOGS);
    }

    isDirty = true;

    // Log ra console để debug
    const consoleMethod = level === LEVEL.ERROR ? 'error' : 'warn';
    console[consoleMethod](`[AutoBlockTab] ${message}`, data || '');
  }

  /**
   * Log warning
   * @param {string} message 
   * @param {any} [data]
   */
  function warn(message, data) {
    addLog(LEVEL.WARN, message, data);
  }

  /**
   * Log error
   * @param {string} message 
   * @param {any} [data]
   */
  function error(message, data) {
    addLog(LEVEL.ERROR, message, data);
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
    logsCache = [];
    isDirty = true;
    await saveToStorage();
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
      extensionVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      logs
    };
  }

  // Auto-save định kỳ (mỗi 30 giây nếu có thay đổi)
  setInterval(saveToStorage, 30000);

  // Load logs khi init
  loadFromStorage();

  // Public API
  return {
    warn,
    error,
    getLogs,
    clearLogs,
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
