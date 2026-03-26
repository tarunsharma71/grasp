import {
  detectBossSurface,
  readBossChatSurface,
  readBossJobDetailSurface,
  readBossSearchSurface,
} from './boss-fast-path.js';

function isBossHost(url) {
  try {
    const { hostname } = new URL(String(url ?? ''));
    return hostname === 'bosszhipin.com'
      || hostname === 'zhipin.com'
      || hostname.endsWith('.bosszhipin.com')
      || hostname.endsWith('.zhipin.com');
  } catch {
    return false;
  }
}

async function readBossPageSignals(page) {
  const [title, pageInfo] = await Promise.all([
    page.title(),
    page.evaluate(() => ({
      hasComposer: Boolean(document.querySelector('.chat-input[contenteditable="true"]')),
      hasSendButton: Boolean(document.querySelector('button.btn-send')),
      hasChatEntry: Boolean(document.querySelector('[data-url*="/wapi/zpgeek/friend/add.json"]')),
      hasSearchLinks: Boolean(document.querySelector('a[href*="job_detail"]')),
    })),
  ]);

  return {
    title,
    ...pageInfo,
  };
}

function buildFastPathContent({ surface, title, url, text }) {
  const normalizedTitle = String(title ?? '').trim() || 'BOSS';
  const normalizedText = String(text ?? '').trim() || normalizedTitle;
  return {
    surface,
    title: normalizedTitle,
    url,
    mainText: normalizedText,
  };
}

export async function readBossFastPath(page) {
  const currentUrl = page.url();
  if (!isBossHost(currentUrl)) {
    return null;
  }

  const pageInfo = await readBossPageSignals(page);
  const { surface } = detectBossSurface(currentUrl, pageInfo);

  if (surface === 'non_boss') {
    return null;
  }

  if (surface === 'search') {
    const result = await readBossSearchSurface(page);
    return buildFastPathContent({
      surface,
      title: pageInfo.title,
      url: result.currentUrl,
      text: (result.jobs ?? []).map((job) => job.title).join('\n'),
    });
  }

  if (surface === 'detail') {
    const result = await readBossJobDetailSurface(page);
    return buildFastPathContent({
      surface,
      title: result.title || pageInfo.title,
      url: result.currentUrl,
      text: [
        result.title,
        result.chatEntry?.text,
        result.chatEntry?.redirectUrl,
      ].filter(Boolean).join('\n'),
    });
  }

  if (surface === 'chat') {
    const result = await readBossChatSurface(page);
    return buildFastPathContent({
      surface,
      title: pageInfo.title,
      url: result.currentUrl,
      text: [
        result.composerText,
        result.sendButtonText,
        result.historySignal,
      ].filter(Boolean).join('\n'),
    });
  }

  return null;
}
