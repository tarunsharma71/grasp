export function createPageGraspState() {
  return {
    lastUrl: null,
    domRevision: 0,
    lastSnapshotHash: null,
    pageIdentity: null,
    currentRole: 'unknown', // unknown | content | form | auth | docs | search | workspace | navigation-heavy | checkpoint
    workspaceSurface: null, // null | list | detail | thread | composer | loading_shell
    workspaceSignals: [],
    graspConfidence: 'unknown', // unknown | low | medium | high
    reacquired: false,
    riskGateDetected: false,
    checkpointSignals: [],
    checkpointKind: null,
    suggestedNextAction: null,
  };
}

function detectCheckpointSignals({ url, title = '', bodyText = '', headings = [], nodes = 0 }) {
  const text = bodyText.toLowerCase();
  const titleText = String(title).toLowerCase();
  const headingText = headings.join(' ').toLowerCase();
  const signals = [];

  if (titleText.includes('just a moment') || text.includes('just a moment')) {
    signals.push('title_or_text_just_a_moment');
  }
  if (text.includes('checking your browser')) signals.push('checking_your_browser');
  if (text.includes('verify you are human')) signals.push('verify_you_are_human');
  if (text.includes('security check')) signals.push('security_check');
  if (text.includes('cf-challenge') || text.includes('cloudflare')) signals.push('cloudflare_challenge');
  if (headingText.includes('just a moment')) signals.push('heading_just_a_moment');
  if (nodes <= 0 && text.length <= 24) signals.push('low_interaction_sparse_page');

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const fullUrl = parsed.toString().toLowerCase();

    if (search.includes('__cf_chl') || fullUrl.includes('cf_chl')) {
      signals.push('cloudflare_challenge_url');
    }

    if ((host.includes('chatgpt.com') || host.includes('openai.com')) && signals.length > 0) {
      signals.push('high_risk_target_with_gate_signals');
    }
  } catch {}

  return [...new Set(signals)];
}

function classifyCheckpointKind(signals = []) {
  if (signals.includes('cloudflare_challenge') || signals.includes('cloudflare_challenge_url') || signals.includes('checking_your_browser')) {
    return 'challenge';
  }
  if (signals.includes('title_or_text_just_a_moment')) {
    return 'waiting_room';
  }
  if (signals.includes('security_check') || signals.includes('verify_you_are_human')) {
    return 'verification';
  }
  if (signals.length > 0) {
    return 'unknown';
  }
  return null;
}

function classifySuggestedNextAction({ riskGateDetected, checkpointKind, nodes = 0 }) {
  if (!riskGateDetected) return null;
  if (checkpointKind === 'waiting_room' && nodes <= 0) return 'wait_then_recheck';
  return 'handoff_required';
}

function getUrlPath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function detectWorkspaceSignals({ url, title = '', bodyText = '', headings = [] }) {
  const text = bodyText.toLowerCase();
  const titleText = String(title).toLowerCase();
  const headingText = headings.join(' ').toLowerCase();
  const path = getUrlPath(url);
  const signals = [];

  if (path.includes('/chat') || path.includes('/thread') || path.includes('/conversation') || path.includes('/inbox')) {
    signals.push('workspace_path');
  }
  if (path.includes('/message') || path.includes('/msg')) {
    signals.push('workspace_message_path');
  }
  if (text.includes('按enter键发送') || text.includes('发消息') || text.includes('发送消息')) {
    signals.push('workspace_composer_text');
  }
  if (text.includes('消息') || text.includes('聊天') || text.includes('对话') || headingText.includes('消息')) {
    signals.push('workspace_thread_text');
  }
  if (text.includes('加载中，请稍候') || text.includes('加载中') || titleText.includes('loading')) {
    signals.push('workspace_loading_shell');
  }
  if (text.includes('详情') || headingText.includes('详情') || path.includes('/detail')) {
    signals.push('workspace_detail');
  }
  if (text.includes('列表') || headingText.includes('列表') || path.includes('/list')) {
    signals.push('workspace_list');
  }

  return [...new Set(signals)];
}

function classifyWorkspaceSurface(signals = [], { bodyText = '', headings = [], url = '' }) {
  const text = bodyText.toLowerCase();
  const headingText = headings.join(' ').toLowerCase();
  const path = getUrlPath(url);

  if (signals.includes('workspace_loading_shell') || text.includes('加载中，请稍候') || text.includes('加载中')) {
    return 'loading_shell';
  }
  if (
    signals.includes('workspace_path') ||
    signals.includes('workspace_thread_text') ||
    path.includes('/chat') ||
    path.includes('/thread') ||
    path.includes('/conversation') ||
    path.includes('/inbox') ||
    text.includes('对话') ||
    text.includes('聊天') ||
    text.includes('消息')
  ) {
    return 'thread';
  }
  if (
    signals.includes('workspace_message_path') ||
    signals.includes('workspace_composer_text') ||
    text.includes('按enter键发送') ||
    text.includes('发消息') ||
    text.includes('发送消息')
  ) {
    return 'composer';
  }
  if (signals.includes('workspace_detail') || text.includes('详情') || headingText.includes('详情') || path.includes('/detail')) {
    return 'detail';
  }
  if (signals.includes('workspace_list') || text.includes('列表') || headingText.includes('列表') || path.includes('/list')) {
    return 'list';
  }
  return 'list';
}

function classifyPageRole({ url, title = '', bodyText = '', nodes = 0, forms = 0, navs = 0, headings = [] }) {
  const text = bodyText.toLowerCase();
  const path = getUrlPath(url);

  const loginHints = ['sign in', 'log in', 'login', 'password', 'username', 'email address'];
  const searchHints = ['search results', 'no results', 'filter results'];
  const formHints = ['submit', 'required', 'email', 'message'];
  const headingText = headings.join(' ').toLowerCase();
  const checkpointSignals = detectCheckpointSignals({ url, title, bodyText, headings, nodes });
  const workspaceSignals = detectWorkspaceSignals({ url, title, bodyText, headings });

  if (checkpointSignals.length > 0) {
    return 'checkpoint';
  }

  if (workspaceSignals.length > 0) {
    return 'workspace';
  }

  if (loginHints.some((hint) => text.includes(hint)) || /\/login\b|\/signin\b/.test(path)) {
    return 'auth';
  }

  const docsByPath = /\/docs\b|\/guide\b|\/reference\b|\/manual\b/.test(path);
  const docsByHeadings = /installation|getting started|api reference|documentation/.test(headingText);
  const docsByLayout = text.includes('on this page') || text.includes("what's next");
  if (docsByPath || docsByHeadings || docsByLayout) {
    return 'docs';
  }

  if (searchHints.some((hint) => text.includes(hint))) {
    return 'search';
  }
  if (forms >= 2 || formHints.some((hint) => text.includes(hint)) || nodes >= 12) {
    return 'form';
  }
  if (navs >= 6) {
    return 'navigation-heavy';
  }
  return 'content';
}

function classifyConfidence({ nodes = 0, bodyText = '', urlChanged, domRevisionChanged }) {
  if (!bodyText) return 'low';
  if (nodes <= 0) return 'low';
  if (urlChanged || domRevisionChanged) return 'medium';
  if (nodes >= 1 && bodyText.length >= 40) return 'high';
  return 'medium';
}

export function applySnapshotToPageGraspState(
  state,
  { url, snapshotHash, title = '', bodyText = '', nodes = 0, forms = 0, navs = 0, headings = [] }
) {
  const next = {
    ...state,
    lastUrl: url,
    lastSnapshotHash: snapshotHash,
  };

  const sameUrl = state.lastUrl === url;
  const urlChanged = !sameUrl;
  const domRevisionChanged = !!(sameUrl && state.lastSnapshotHash && state.lastSnapshotHash !== snapshotHash);

  if (!sameUrl) {
    next.domRevision = 0;
  } else if (domRevisionChanged) {
    next.domRevision = state.domRevision + 1;
  } else {
    next.domRevision = state.domRevision;
  }

  next.reacquired = urlChanged || domRevisionChanged;
  next.pageIdentity = `${url}#${next.domRevision}`;
  next.checkpointSignals = detectCheckpointSignals({ url, title, bodyText, headings, nodes });
  next.riskGateDetected = next.checkpointSignals.length > 0;
  next.checkpointKind = classifyCheckpointKind(next.checkpointSignals);
  next.suggestedNextAction = classifySuggestedNextAction({
    riskGateDetected: next.riskGateDetected,
    checkpointKind: next.checkpointKind,
    nodes,
  });
  next.workspaceSignals = detectWorkspaceSignals({ url, title, bodyText, headings });
  next.currentRole = classifyPageRole({ url, title, bodyText, nodes, forms, navs, headings });
  next.workspaceSurface = next.currentRole === 'workspace' ? classifyWorkspaceSurface(next.workspaceSignals, { bodyText, headings, url }) : null;
  next.graspConfidence = classifyConfidence({ bodyText, nodes, urlChanged, domRevisionChanged });

  return next;
}
