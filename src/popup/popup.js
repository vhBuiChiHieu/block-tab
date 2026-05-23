/**
 * Auto Block Tab - Popup Script
 * Quản lý giao diện popup và tương tác với storage
 * @version 1.1.0
 */

// DOM Elements
const enableToggle = document.getElementById('enableToggle');
const toggleLabel = document.getElementById('toggleLabel');
const blockedCount = document.getElementById('blockedCount');
const nameInput = document.getElementById('nameInput');
const suffixInput = document.getElementById('suffixInput');
const whitelistInput = document.getElementById('whitelistInput');
const addNameBtn = document.getElementById('addName');
const addSuffixBtn = document.getElementById('addSuffix');
const addWhitelistBtn = document.getElementById('addWhitelist');
const nameList = document.getElementById('nameList');
const suffixList = document.getElementById('suffixList');
const whitelistList = document.getElementById('whitelistList');
const namePreview = document.getElementById('namePreview');
const suffixPreview = document.getElementById('suffixPreview');
const whitelistPreview = document.getElementById('whitelistPreview');
const recentBlockedList = document.getElementById('recentBlockedList');
const clearRecentBlockedBtn = document.getElementById('clearRecentBlocked');
const mainTabs = document.querySelectorAll('.main-tab');
const viewPanels = document.querySelectorAll('.view-panel');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

let activeTabUrl = null;

/**
 * Load settings từ storage
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    // Update toggle
    enableToggle.checked = settings.enabled;
    updateToggleLabel(settings.enabled);
    document.body.classList.toggle('disabled', !settings.enabled);

    // Update stats
    blockedCount.textContent = settings.stats?.blockedCount || 0;

    // Update lists
    renderList(nameList, settings.nameBlacklist || [], 'name');
    renderList(suffixList, settings.suffixBlacklist || [], 'suffix');
    renderList(whitelistList, settings.whitelistDomains || [], 'whitelist');
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

/**
 * Cập nhật label toggle
 */
function updateToggleLabel(enabled) {
  toggleLabel.textContent = enabled ? 'Bật' : 'Tắt';
}

/**
 * Render danh sách blacklist
 */
function renderList(listElement, items, type) {
  if (items.length === 0) {
    listElement.innerHTML = '<li class="empty">Chưa có mục nào</li>';
    return;
  }

  listElement.innerHTML = items.map((item, index) => `
    <li class="list-item">
      <span>${escapeHtml(item)}</span>
      <button class="btn-remove" data-type="${type}" data-index="${index}">×</button>
    </li>
  `).join('');
}

/**
 * Escape HTML để tránh XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function getRuleConfig(type) {
  const configs = {
    name: { key: 'nameBlacklist', label: 'tên domain' },
    suffix: { key: 'suffixBlacklist', label: 'đuôi domain' },
    whitelist: { key: 'whitelistDomains', label: 'whitelist' }
  };

  return configs[type];
}

function normalizeRuleItems(items, label = 'Danh sách') {
  if (!Array.isArray(items)) {
    throw new Error(`${label} phải là mảng`);
  }

  return [...new Set(
    items.map((item) => {
      if (typeof item !== 'string') {
        throw new Error(`${label} chỉ được chứa chuỗi`);
      }

      return item.trim().toLowerCase();
    }).filter(Boolean)
  )];
}

function parseImportData(importData) {
  if (!isPlainObject(importData) || typeof importData.version !== 'string' || !isPlainObject(importData.data)) {
    throw new Error('File không đúng định dạng');
  }

  return {
    nameBlacklist: normalizeRuleItems(importData.data.nameBlacklist ?? [], 'Danh sách tên domain'),
    suffixBlacklist: normalizeRuleItems(importData.data.suffixBlacklist ?? [], 'Danh sách đuôi domain'),
    whitelistDomains: normalizeRuleItems(importData.data.whitelistDomains ?? [], 'Danh sách whitelist')
  };
}

/**
 * Thêm item vào blacklist
 */
async function addToBlacklist(type, value) {
  const trimmedValue = value.trim().toLowerCase();
  if (!trimmedValue) return;

  try {
    const config = getRuleConfig(type);
    const settings = await chrome.storage.sync.get({ [config.key]: [] });
    const list = settings[config.key];

    // Kiểm tra trùng lặp
    if (list.includes(trimmedValue)) {
      return;
    }

    list.push(trimmedValue);
    await chrome.storage.sync.set({ [config.key]: list });

    // Reload list
    loadSettings();
  } catch (e) {
    console.error('Error adding to blacklist:', e);
  }
}

/**
 * Xóa item khỏi blacklist
 */
async function removeFromBlacklist(type, index) {
  try {
    const config = getRuleConfig(type);
    const settings = await chrome.storage.sync.get({ [config.key]: [] });
    const list = settings[config.key];

    if (index < 0 || index >= list.length) {
      return;
    }

    list.splice(index, 1);
    await chrome.storage.sync.set({ [config.key]: list });

    // Reload list
    loadSettings();
  } catch (e) {
    console.error('Error removing from blacklist:', e);
  }
}

/**
 * Toggle extension on/off
 */
async function toggleExtension(enabled) {
  try {
    await chrome.storage.sync.set({ enabled });
    updateToggleLabel(enabled);
    document.body.classList.toggle('disabled', !enabled);
  } catch (e) {
    console.error('Error toggling extension:', e);
  }
}

/**
 * Chuyển màn hình chính
 */
function switchView(viewName) {
  mainTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  viewPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `${viewName}-view`);
  });
}

/**
 * Chuyển tab
 */
function switchTab(tabName) {
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-content`);
  });
}

function setPreview(previewElement, message, state = '') {
  previewElement.textContent = message;
  previewElement.className = `preview ${state}`.trim();
}

function updatePreview(type, input, previewElement) {
  const value = input.value.trim().toLowerCase();
  if (!value) {
    setPreview(previewElement, '');
    return;
  }

  if (!activeTabUrl || !globalThis.BlockerUtils.getHostname(activeTabUrl)) {
    setPreview(previewElement, 'Không có tab hợp lệ để xem trước', 'neutral');
    return;
  }

  if (type === 'whitelist') {
    const result = globalThis.BlockerUtils.checkWhitelistUrl(activeTabUrl, [value]);
    setPreview(
      previewElement,
      result.matched ? `Khớp tab hiện tại: ${result.hostname}` : 'Không khớp tab hiện tại',
      result.matched ? 'match' : 'no-match'
    );
    return;
  }

  const result = type === 'name'
    ? globalThis.BlockerUtils.shouldBlockUrl(activeTabUrl, [value], [])
    : globalThis.BlockerUtils.shouldBlockUrl(activeTabUrl, [], [value]);

  setPreview(
    previewElement,
    result.blocked ? `Sẽ chặn tab hiện tại bằng rule "${result.matchedRule}"` : 'Không khớp tab hiện tại',
    result.blocked ? 'match' : 'no-match'
  );
}

function wireBlacklistInput(type, input, button, previewElement) {
  const submit = async () => {
    await addToBlacklist(type, input.value);
    input.value = '';
    setPreview(previewElement, '');
    input.focus();
  };

  button.addEventListener('click', submit);
  input.addEventListener('input', () => updatePreview(type, input, previewElement));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submit();
    }
  });
}

async function loadActiveTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabUrl = tab?.url || tab?.pendingUrl || null;
  } catch (e) {
    activeTabUrl = null;
    console.error('Error loading active tab:', e);
  }
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });
}

function renderRecentBlocked(entries) {
  if (!entries.length) {
    recentBlockedList.innerHTML = '<li class="empty">Chưa có tab nào bị chặn</li>';
    return;
  }

  recentBlockedList.innerHTML = entries.map((entry) => `
    <li class="recent-item">
      <div class="recent-main">
        <span class="recent-host">${escapeHtml(entry.hostname || '')}</span>
        <span class="recent-time">${escapeHtml(formatTimestamp(entry.timestamp))}</span>
      </div>
      <div class="recent-meta">${escapeHtml(entry.reason || '')}: ${escapeHtml(entry.matchedRule || '')}</div>
      <div class="recent-url" title="${escapeHtml(entry.url || '')}">${escapeHtml(entry.url || '')}</div>
    </li>
  `).join('');
}

async function loadRecentBlocked() {
  try {
    const entries = await globalThis.Logger.getRecentBlocked();
    renderRecentBlocked(entries);
  } catch (e) {
    console.error('Error loading recent blocked:', e);
  }
}

async function clearRecentBlocked() {
  try {
    await globalThis.Logger.clearRecentBlocked();
    renderRecentBlocked([]);
  } catch (e) {
    console.error('Error clearing recent blocked:', e);
  }
}

// === Event Listeners ===

// Toggle extension
enableToggle.addEventListener('change', (e) => {
  toggleExtension(e.target.checked);
});

// Main view switching
mainTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.view);
  });
});

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
  });
});

wireBlacklistInput('name', nameInput, addNameBtn, namePreview);
wireBlacklistInput('suffix', suffixInput, addSuffixBtn, suffixPreview);
wireBlacklistInput('whitelist', whitelistInput, addWhitelistBtn, whitelistPreview);

// Remove items (event delegation)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-remove')) {
    const type = e.target.dataset.type;
    const index = parseInt(e.target.dataset.index, 10);
    removeFromBlacklist(type, index);
  }
});

clearRecentBlockedBtn.addEventListener('click', clearRecentBlocked);

// Listen for storage changes (update stats in real-time)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.stats) {
    blockedCount.textContent = changes.stats.newValue?.blockedCount || 0;
  }

  if (namespace === 'local' && changes.autoBlockTab_recentBlocked) {
    renderRecentBlocked(changes.autoBlockTab_recentBlocked.newValue || []);
  }
});

// === Export/Import Functions ===

/**
 * Export blacklists ra file JSON
 */
async function exportBlacklist() {
  try {
    const settings = await chrome.storage.sync.get({
      nameBlacklist: [],
      suffixBlacklist: [],
      whitelistDomains: []
    });

    const exportData = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      data: {
        nameBlacklist: settings.nameBlacklist,
        suffixBlacklist: settings.suffixBlacklist,
        whitelistDomains: settings.whitelistDomains
      }
    };

    // Tạo file và download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `auto-block-tab-backup-${new Date().toISOString().slice(0, 10)}.json`;

    // Dùng chrome.downloads API
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error('Error exporting blacklist:', e);
    alert('Lỗi khi xuất file: ' + e.message);
  }
}

/**
 * Import blacklists từ file JSON
 */
async function importBlacklist(file) {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    const { nameBlacklist, suffixBlacklist, whitelistDomains } = parseImportData(importData);

    // Confirm với user
    const currentSettings = await chrome.storage.sync.get({
      nameBlacklist: [],
      suffixBlacklist: [],
      whitelistDomains: []
    });

    const hasExisting = currentSettings.nameBlacklist.length > 0 ||
                        currentSettings.suffixBlacklist.length > 0 ||
                        currentSettings.whitelistDomains.length > 0;

    let shouldReplace = true;
    if (hasExisting) {
      shouldReplace = confirm(
        `Bạn đang có ${currentSettings.nameBlacklist.length} tên domain, ${currentSettings.suffixBlacklist.length} đuôi domain và ${currentSettings.whitelistDomains.length} whitelist.\n\n` +
        `File import có ${nameBlacklist.length} tên domain, ${suffixBlacklist.length} đuôi domain và ${whitelistDomains.length} whitelist.\n\n` +
        `Bấm OK để THAY THẾ toàn bộ\n` +
        `Bấm Cancel để GỘP với danh sách hiện tại`
      );
    }

    if (shouldReplace) {
      // Replace hoàn toàn
      await chrome.storage.sync.set({
        nameBlacklist,
        suffixBlacklist,
        whitelistDomains
      });
    } else {
      // Merge (loại bỏ trùng lặp)
      const mergedNames = [...new Set([...currentSettings.nameBlacklist, ...nameBlacklist])];
      const mergedSuffixes = [...new Set([...currentSettings.suffixBlacklist, ...suffixBlacklist])];
      const mergedWhitelist = [...new Set([...currentSettings.whitelistDomains, ...whitelistDomains])];

      await chrome.storage.sync.set({
        nameBlacklist: mergedNames,
        suffixBlacklist: mergedSuffixes,
        whitelistDomains: mergedWhitelist
      });
    }

    // Reload UI
    loadSettings();
    alert('Import thành công!');
  } catch (e) {
    console.error('Error importing blacklist:', e);
    alert('Lỗi khi nhập file: ' + e.message);
  }
}

// Export button click
exportBtn.addEventListener('click', exportBlacklist);

// Import button click - trigger file input
importBtn.addEventListener('click', () => {
  importFile.click();
});

// File selected
importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    importBlacklist(file);
    // Reset input để có thể import cùng file nhiều lần
    importFile.value = '';
  }
});

// Initialize
loadActiveTabUrl().then(() => {
  loadSettings();
  loadRecentBlocked();
});
