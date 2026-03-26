function normalizeHostname(url) {
  try {
    return new URL(String(url ?? '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isRuntimeHost(hostname) {
  return hostname === 'bosszhipin.com'
    || hostname === 'zhipin.com'
    || hostname.endsWith('.bosszhipin.com')
    || hostname.endsWith('.zhipin.com')
    || hostname === 'mp.weixin.qq.com'
    || hostname.endsWith('.mp.weixin.qq.com')
    || hostname === 'xiaohongshu.com'
    || hostname === 'www.xiaohongshu.com'
    || hostname.endsWith('.xiaohongshu.com')
    || hostname === 'xhslink.com'
    || hostname.endsWith('.xhslink.com');
}

export function selectEngine({ tool, url } = {}) {
  const hostname = normalizeHostname(url);
  return {
    tool: tool ?? 'extract',
    engine: isRuntimeHost(hostname) ? 'runtime' : 'data',
  };
}
