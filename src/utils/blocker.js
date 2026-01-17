/**
 * Auto Block Tab - URL Blocker Module
 * Xử lý logic matching URL với blacklist
 * @version 1.0.0
 */

/**
 * Kiểm tra URL có match với blacklist tên domain không
 * Ví dụ: "ads" sẽ match với "super.ads.example.com"
 * 
 * @param {string} url - URL cần kiểm tra
 * @param {string[]} nameBlacklist - Danh sách tên domain cần chặn
 * @returns {string|null} - Tên đã match hoặc null nếu không match
 */
function checkDomainName(url, nameBlacklist) {
  if (!url || !nameBlacklist || nameBlacklist.length === 0) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const parts = hostname.split('.');

    for (const part of parts) {
      for (const blocked of nameBlacklist) {
        if (part === blocked.toLowerCase()) {
          return blocked;
        }
      }
    }
  } catch (e) {
    // URL không hợp lệ, bỏ qua
  }

  return null;
}

/**
 * Kiểm tra URL có match với blacklist đuôi domain không
 * Ví dụ: ".xyz" sẽ match với "freewin.xyz"
 * 
 * @param {string} url - URL cần kiểm tra
 * @param {string[]} suffixBlacklist - Danh sách đuôi domain cần chặn
 * @returns {string|null} - Đuôi đã match hoặc null nếu không match
 */
function checkDomainSuffix(url, suffixBlacklist) {
  if (!url || !suffixBlacklist || suffixBlacklist.length === 0) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const suffix of suffixBlacklist) {
      const normalizedSuffix = suffix.toLowerCase().startsWith('.') 
        ? suffix.toLowerCase() 
        : '.' + suffix.toLowerCase();
      
      if (hostname.endsWith(normalizedSuffix)) {
        return suffix;
      }
    }
  } catch (e) {
    // URL không hợp lệ, bỏ qua
  }

  return null;
}

/**
 * Kiểm tra URL có nên bị chặn không
 * 
 * @param {string} url - URL cần kiểm tra
 * @param {string[]} nameBlacklist - Blacklist tên domain
 * @param {string[]} suffixBlacklist - Blacklist đuôi domain
 * @returns {{ blocked: boolean, reason: string|null, matchedRule: string|null }}
 */
function shouldBlockUrl(url, nameBlacklist, suffixBlacklist) {
  // Kiểm tra tên domain trước
  const nameMatch = checkDomainName(url, nameBlacklist);
  if (nameMatch) {
    return {
      blocked: true,
      reason: 'name',
      matchedRule: nameMatch
    };
  }

  // Kiểm tra đuôi domain
  const suffixMatch = checkDomainSuffix(url, suffixBlacklist);
  if (suffixMatch) {
    return {
      blocked: true,
      reason: 'suffix',
      matchedRule: suffixMatch
    };
  }

  return {
    blocked: false,
    reason: null,
    matchedRule: null
  };
}

// Export cho service worker
if (typeof globalThis !== 'undefined') {
  globalThis.BlockerUtils = {
    checkDomainName,
    checkDomainSuffix,
    shouldBlockUrl
  };
}
