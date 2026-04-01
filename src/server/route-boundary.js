const BOUNDARY_TEMPLATES = {
  public_read: {
    summary: 'Stay on the read/extract path. Prefer inspect, extract, extract_structured, extract_batch, share_page, and continue before low-level actions.',
    preferred_tools: ['inspect', 'extract', 'extract_structured', 'extract_batch', 'share_page', 'continue'],
    avoid: ['page-changing actions', 'form_runtime tools', 'workspace_runtime tools'],
    confirmation: null,
  },
  live_session: {
    summary: 'Stay on the live session runtime loop. Prefer inspect, extract, continue, and explain_route until a specialized surface is clearly present.',
    preferred_tools: ['inspect', 'extract', 'continue', 'explain_route'],
    avoid: ['premature low-level primitives', 'form_runtime tools without a form surface', 'workspace_runtime tools without a workspace surface'],
    confirmation: null,
  },
  session_warmup: {
    summary: 'Warm the session before direct entry. Use preheat_session first, then re-enter the runtime loop after trust improves.',
    preferred_tools: ['preheat_session', 'entry', 'inspect'],
    avoid: ['repeated direct retries', 'form_runtime tools', 'workspace_runtime tools'],
    confirmation: null,
  },
  form_runtime: {
    summary: 'Use the form surface. Fill safe text fields first, keep review-tier controls explicit, and submit only through safe_submit.',
    preferred_tools: ['form_inspect', 'fill_form', 'set_option', 'set_date', 'verify_form', 'safe_submit'],
    avoid: ['blind field writes', 'raw submit clicks', 'navigate away mid-form'],
    confirmation: 'safe_submit(mode="confirm", confirmation="SUBMIT")',
  },
  workspace_runtime: {
    summary: 'Use the workspace surface. Select the live item, draft safely, preview sends, and execute only through execute_action.',
    preferred_tools: ['workspace_inspect', 'select_live_item', 'draft_action', 'execute_action', 'verify_outcome'],
    avoid: ['raw send clicks', 'press Enter to send', 'execute before draft or preview'],
    confirmation: 'execute_action(mode="confirm", confirmation="EXECUTE")',
  },
  handoff: {
    summary: 'This flow is blocked on handoff. Stop direct action attempts, persist the handoff step, let the human recover the page, then resume.',
    preferred_tools: ['request_handoff', 'mark_handoff_in_progress', 'mark_handoff_done', 'resume_after_handoff', 'continue'],
    avoid: ['looping retries', 'form_runtime actions while gated', 'workspace_runtime actions while gated'],
    confirmation: null,
  },
};

export function inferAgentBoundaryKey({
  status,
  result = {},
  continuation = {},
  route = null,
} = {}) {
  if (
    status === 'handoff_required'
    || status === 'gated'
    || route?.selected_mode === 'handoff'
    || continuation?.suggested_next_action === 'request_handoff'
  ) {
    return 'handoff';
  }

  if (result?.task_kind === 'form' || route?.selected_mode === 'form_runtime') {
    return 'form_runtime';
  }

  if (result?.task_kind === 'workspace' || route?.selected_mode === 'workspace_runtime') {
    return 'workspace_runtime';
  }

  if (status === 'warmup' || continuation?.suggested_next_action === 'preheat_session') {
    return 'session_warmup';
  }

  if (route?.selected_mode === 'public_read') {
    return 'public_read';
  }

  if (route?.selected_mode === 'live_session') {
    return 'live_session';
  }

  return null;
}

export function buildAgentBoundary(input = {}) {
  const key = inferAgentBoundaryKey(input);
  if (!key) return null;

  const template = BOUNDARY_TEMPLATES[key];
  return {
    key,
    summary: template.summary,
    preferred_tools: [...template.preferred_tools],
    avoid: [...template.avoid],
    confirmation: template.confirmation,
    next_step: input?.continuation?.suggested_next_action ?? null,
  };
}

export function buildAgentBoundaryLines(boundary) {
  if (!boundary) return [];

  return [
    `Boundary: ${boundary.key}`,
    `Boundary guidance: ${boundary.summary}`,
    boundary.confirmation ? `Boundary confirmation: ${boundary.confirmation}` : null,
  ].filter(Boolean);
}
