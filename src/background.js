/**
 * Auto Block Tab - Background Service Worker
 * Xử lý việc chặn/đóng tab quảng cáo
 * @version 1.0.1
 */

// Import utils
importScripts('./utils/blocker.js');
importScripts('./utils/logger.js');

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  nameBlacklist: [],
  suffixBlacklist: [],
  stats: {
    blockedCount: 0,
    lastBlocked: null
  }
};

/**
 * Lấy settings từ storage (LUÔN load fresh - không cache)
 * Service worker có thể bị terminate bất cứ lúc nào nên không nên cache
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    console.log('[AutoBlockTab] Loaded settings:', {
      enabled: result.enabled,
      nameCount: result.nameBlacklist?.length || 0,
      suffixCount: result.suffixBlacklist?.length || 0
    });
    return result;
  } catch (e) {
    globalThis.Logger.error('Error loading settings', { error: e.message });
    return DEFAULT_SETTINGS;
  }
}

/**
 * Cập nhật thống kê khi chặn tab
 */
async function updateStats() {
  try {
    const settings = await getSettings();
    const newStats = {
      blockedCount: (settings.stats?.blockedCount || 0) + 1,
      lastBlocked: new Date().toISOString()
    };
    await chrome.storage.sync.set({ stats: newStats });
    console.log('[AutoBlockTab] Stats updated:', newStats.blockedCount);
  } catch (e) {
    globalThis.Logger.error('Error updating stats', { error: e.message });
  }
}

/**
 * Kiểm tra và chặn tab nếu cần
 */
async function checkAndBlockTab(tabId, url, source) {
  // Bỏ qua các URL đặc biệt
  if (!url || 
      url === 'about:blank' ||
      url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:')) {
    return false;
  }

  console.log(`[AutoBlockTab] Checking (${source}):`, url);

  try {
    const settings = await getSettings();

    // Kiểm tra extension có được bật không
    if (!settings.enabled) {
      console.log('[AutoBlockTab] Extension disabled, skipping');
      return false;
    }

    const nameBlacklist = settings.nameBlacklist || [];
    const suffixBlacklist = settings.suffixBlacklist || [];

    // Kiểm tra có blacklist không
    if (nameBlacklist.length === 0 && suffixBlacklist.length === 0) {
      console.log('[AutoBlockTab] No blacklist rules, skipping');
      return false;
    }

    // Kiểm tra URL có nên bị chặn không
    const result = globalThis.BlockerUtils.shouldBlockUrl(
      url,
      nameBlacklist,
      suffixBlacklist
    );

    console.log('[AutoBlockTab] Check result:', result);

    if (result.blocked) {
      // Đóng tab ngay lập tức
      await chrome.tabs.remove(tabId);
      
      // Cập nhật thống kê
      await updateStats();

      console.log(`[AutoBlockTab] ✅ BLOCKED: ${url} (${result.reason}: ${result.matchedRule})`);
      return true;
    }
  } catch (e) {
    globalThis.Logger.error('Error checking tab', { url, error: e.message });
  }

  return false;
}

// === Event Listeners ===

// Lắng nghe khi URL của tab thay đổi
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Xử lý khi có URL mới (bao gồm cả lần đầu load và redirect)
  if (changeInfo.url) {
    checkAndBlockTab(tabId, changeInfo.url, 'onUpdated');
  }
});

// Lắng nghe khi tab mới được tạo và đã có URL
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.pendingUrl) {
    checkAndBlockTab(tab.id, tab.pendingUrl, 'onCreated-pending');
  } else if (tab.url) {
    checkAndBlockTab(tab.id, tab.url, 'onCreated');
  }
});

// Lắng nghe thay đổi settings từ popup (chỉ để log)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    console.log('[AutoBlockTab] Settings changed:', Object.keys(changes));
  }
});

// Log khi service worker khởi động
console.log('[AutoBlockTab] Service worker started - v1.0.2 (with Logger)');
