/**
 * Auto Block Tab - Popup Script
 * Quản lý giao diện popup và tương tác với storage
 * @version 1.0.0
 */

// DOM Elements
const enableToggle = document.getElementById('enableToggle');
const toggleLabel = document.getElementById('toggleLabel');
const blockedCount = document.getElementById('blockedCount');
const nameInput = document.getElementById('nameInput');
const suffixInput = document.getElementById('suffixInput');
const addNameBtn = document.getElementById('addName');
const addSuffixBtn = document.getElementById('addSuffix');
const nameList = document.getElementById('nameList');
const suffixList = document.getElementById('suffixList');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

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

function normalizeBlacklistItems(items) {
  if (!Array.isArray(items)) {
    throw new Error('Danh sách blacklist phải là mảng');
  }

  return [...new Set(
    items.map((item) => {
      if (typeof item !== 'string') {
        throw new Error('Blacklist chỉ được chứa chuỗi');
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
    nameBlacklist: normalizeBlacklistItems(importData.data.nameBlacklist ?? []),
    suffixBlacklist: normalizeBlacklistItems(importData.data.suffixBlacklist ?? [])
  };
}

/**
 * Thêm item vào blacklist
 */
async function addToBlacklist(type, value) {
  const trimmedValue = value.trim().toLowerCase();
  if (!trimmedValue) return;

  try {
    const key = type === 'name' ? 'nameBlacklist' : 'suffixBlacklist';
    const settings = await chrome.storage.sync.get({ [key]: [] });
    const list = settings[key];

    // Kiểm tra trùng lặp
    if (list.includes(trimmedValue)) {
      return;
    }

    list.push(trimmedValue);
    await chrome.storage.sync.set({ [key]: list });
    
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
    const key = type === 'name' ? 'nameBlacklist' : 'suffixBlacklist';
    const settings = await chrome.storage.sync.get({ [key]: [] });
    const list = settings[key];

    if (index < 0 || index >= list.length) {
      return;
    }

    list.splice(index, 1);
    await chrome.storage.sync.set({ [key]: list });
    
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

function wireBlacklistInput(type, input, button) {
  const submit = async () => {
    await addToBlacklist(type, input.value);
    input.value = '';
    input.focus();
  };

  button.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submit();
    }
  });
}

// === Event Listeners ===

// Toggle extension
enableToggle.addEventListener('change', (e) => {
  toggleExtension(e.target.checked);
});

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
  });
});

wireBlacklistInput('name', nameInput, addNameBtn);
wireBlacklistInput('suffix', suffixInput, addSuffixBtn);

// Remove items (event delegation)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-remove')) {
    const type = e.target.dataset.type;
    const index = parseInt(e.target.dataset.index, 10);
    removeFromBlacklist(type, index);
  }
});

// Listen for storage changes (update stats in real-time)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.stats) {
    blockedCount.textContent = changes.stats.newValue?.blockedCount || 0;
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
      suffixBlacklist: []
    });

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        nameBlacklist: settings.nameBlacklist,
        suffixBlacklist: settings.suffixBlacklist
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
    const { nameBlacklist, suffixBlacklist } = parseImportData(importData);

    // Confirm với user
    const currentSettings = await chrome.storage.sync.get({
      nameBlacklist: [],
      suffixBlacklist: []
    });

    const hasExisting = currentSettings.nameBlacklist.length > 0 || 
                        currentSettings.suffixBlacklist.length > 0;

    let shouldReplace = true;
    if (hasExisting) {
      shouldReplace = confirm(
        `Bạn đang có ${currentSettings.nameBlacklist.length} tên domain và ${currentSettings.suffixBlacklist.length} đuôi domain.\n\n` +
        `File import có ${nameBlacklist.length} tên domain và ${suffixBlacklist.length} đuôi domain.\n\n` +
        `Bấm OK để THAY THẾ toàn bộ\n` +
        `Bấm Cancel để GỘP với danh sách hiện tại`
      );
    }

    if (shouldReplace) {
      // Replace hoàn toàn
      await chrome.storage.sync.set({
        nameBlacklist,
        suffixBlacklist
      });
    } else {
      // Merge (loại bỏ trùng lặp)
      const mergedNames = [...new Set([...currentSettings.nameBlacklist, ...nameBlacklist])];
      const mergedSuffixes = [...new Set([...currentSettings.suffixBlacklist, ...suffixBlacklist])];
      
      await chrome.storage.sync.set({
        nameBlacklist: mergedNames,
        suffixBlacklist: mergedSuffixes
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
loadSettings();

