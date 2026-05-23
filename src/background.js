/**
 * Auto Block Tab - Background Service Worker
 * Xử lý việc chặn/đóng tab quảng cáo
 * @version 1.1.0
 */

// Import utils
importScripts('./utils/settings.js');
importScripts('./utils/blocker.js');
importScripts('./utils/logger.js');

function isSpecialUrl(url) {
  return !url ||
    url === 'about:blank' ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:');
}

function normalizeSettings(settings) {
  return {
    enabled: settings.enabled !== false,
    nameBlacklist: Array.isArray(settings.nameBlacklist) ? settings.nameBlacklist : [],
    suffixBlacklist: Array.isArray(settings.suffixBlacklist) ? settings.suffixBlacklist : [],
    whitelistDomains: Array.isArray(settings.whitelistDomains) ? settings.whitelistDomains : [],
    stats: {
      blockedCount: Number.isFinite(settings.stats?.blockedCount) ? settings.stats.blockedCount : 0,
      lastBlocked: settings.stats?.lastBlocked || null
    }
  };
}

/**
 * Lấy settings từ storage (LUÔN load fresh - không cache)
 * Service worker có thể bị terminate bất cứ lúc nào nên không nên cache
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return normalizeSettings(result);
  } catch (e) {
    await globalThis.Logger.error('Error loading settings', { error: e.message });
    return DEFAULT_SETTINGS;
  }
}

// Serialize read-modify-write để tránh race condition khi nhiều tab bị block cùng lúc
let _statsQueue = Promise.resolve();

/**
 * Cập nhật thống kê khi chặn tab
 */
async function updateStats() {
  _statsQueue = _statsQueue.then(async () => {
    try {
      const { stats } = await chrome.storage.sync.get({ stats: DEFAULT_SETTINGS.stats });
      const currentStats = {
        blockedCount: Number.isFinite(stats?.blockedCount) ? stats.blockedCount : 0,
        lastBlocked: stats?.lastBlocked || null
      };

      await chrome.storage.sync.set({
        stats: {
          blockedCount: currentStats.blockedCount + 1,
          lastBlocked: new Date().toISOString()
        }
      });
    } catch (e) {
      await globalThis.Logger.error('Error updating stats', { error: e.message });
    }
  });
  await _statsQueue;
}

/**
 * Kiểm tra và chặn tab nếu cần
 */
async function checkAndBlockTab(tabId, url, source) {
  if (isSpecialUrl(url)) {
    return false;
  }

  try {
    const settings = await getSettings();

    if (!settings.enabled) {
      return false;
    }

    if (settings.nameBlacklist.length === 0 && settings.suffixBlacklist.length === 0) {
      return false;
    }

    const result = globalThis.BlockerUtils.getBlockDecision(url, settings);

    if (result.blocked) {
      await chrome.tabs.remove(tabId);
      await updateStats();
      await globalThis.Logger.addRecentBlocked({
        timestamp: new Date().toISOString(),
        url,
        hostname: result.hostname,
        reason: result.reason,
        matchedRule: result.matchedRule,
        source
      });
      return true;
    }
  } catch (e) {
    await globalThis.Logger.error('Error checking tab', { source, url, error: e.message });
  }

  return false;
}

chrome.runtime.onSuspend.addListener(() => {
  globalThis.Logger.flush();
});

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

