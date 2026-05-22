/**
 * Auto Block Tab - URL Blocker Module
 * Xử lý logic matching URL với blacklist
 * @version 1.0.0
 */

function parseHostname(url) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch (e) {
    return null;
  }
}

function normalizeNameRules(nameBlacklist) {
  return nameBlacklist.map((rule) => ({
    original: rule,
    normalized: rule.toLowerCase()
  }));
}

function normalizeSuffixRules(suffixBlacklist) {
  return suffixBlacklist.map((rule) => ({
    original: rule,
    normalized: rule.toLowerCase().startsWith('.') ? rule.toLowerCase() : `.${rule.toLowerCase()}`
  }));
}

function checkDomainNameFromHostname(hostname, nameBlacklist) {
  const parts = hostname.split('.');
  const normalizedRules = normalizeNameRules(nameBlacklist);

  for (const part of parts) {
    for (const rule of normalizedRules) {
      if (part === rule.normalized) {
        return rule.original;
      }
    }
  }

  return null;
}

function checkDomainSuffixFromHostname(hostname, suffixBlacklist) {
  const normalizedRules = normalizeSuffixRules(suffixBlacklist);

  for (const rule of normalizedRules) {
    if (hostname.endsWith(rule.normalized)) {
      return rule.original;
    }
  }

  return null;
}

function checkWhitelistFromHostname(hostname, whitelistDomains) {
  const normalizedRules = normalizeNameRules(whitelistDomains || []);

  for (const rule of normalizedRules) {
    const normalized = rule.normalized.startsWith('.') ? rule.normalized.slice(1) : rule.normalized;
    if (hostname === normalized || hostname.endsWith(`.${normalized}`)) {
      return rule.original;
    }
  }

  return null;
}

/**
 * Kiểm tra URL có match với blacklist tên domain không
 * Ví dụ: "ads" sẽ match với "super.ads.example.com"
 *
 * @param {string} url - URL cần kiểm tra
 * @param {string[]} nameBlacklist - Danh sách tên domain cần chặn
 * @returns {string|null} - Tên đã match hoặc null nếu không match
 */
function checkDomainName(url, nameBlacklist) {
  if (!nameBlacklist || nameBlacklist.length === 0) {
    return null;
  }

  const hostname = parseHostname(url);
  if (!hostname) {
    return null;
  }

  return checkDomainNameFromHostname(hostname, nameBlacklist);
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
  if (!suffixBlacklist || suffixBlacklist.length === 0) {
    return null;
  }

  const hostname = parseHostname(url);
  if (!hostname) {
    return null;
  }

  return checkDomainSuffixFromHostname(hostname, suffixBlacklist);
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
  const hostname = parseHostname(url);
  if (!hostname) {
    return {
      blocked: false,
      reason: null,
      matchedRule: null
    };
  }

  const nameMatch = checkDomainNameFromHostname(hostname, nameBlacklist || []);
  if (nameMatch) {
    return {
      blocked: true,
      reason: 'name',
      matchedRule: nameMatch
    };
  }

  const suffixMatch = checkDomainSuffixFromHostname(hostname, suffixBlacklist || []);
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

function checkWhitelistUrl(url, whitelistDomains) {
  const hostname = parseHostname(url);
  if (!hostname) {
    return {
      matched: false,
      hostname: null,
      matchedRule: null
    };
  }

  const matchedRule = checkWhitelistFromHostname(hostname, whitelistDomains);
  return {
    matched: Boolean(matchedRule),
    hostname,
    matchedRule
  };
}

function getBlockDecision(url, settings) {
  const hostname = parseHostname(url);
  if (!hostname) {
    return {
      blocked: false,
      whitelisted: false,
      hostname: null,
      reason: null,
      matchedRule: null,
      whitelistRule: null
    };
  }

  const whitelistRule = checkWhitelistFromHostname(hostname, settings.whitelistDomains || []);
  if (whitelistRule) {
    return {
      blocked: false,
      whitelisted: true,
      hostname,
      reason: 'whitelist',
      matchedRule: null,
      whitelistRule
    };
  }

  const blockResult = shouldBlockUrl(url, settings.nameBlacklist || [], settings.suffixBlacklist || []);
  return {
    blocked: blockResult.blocked,
    whitelisted: false,
    hostname,
    reason: blockResult.reason,
    matchedRule: blockResult.matchedRule,
    whitelistRule: null
  };
}

// Export cho service worker
if (typeof globalThis !== 'undefined') {
  globalThis.BlockerUtils = {
    getHostname: parseHostname,
    checkDomainName,
    checkDomainSuffix,
    checkWhitelistUrl,
    getBlockDecision,
    shouldBlockUrl
  };
}
