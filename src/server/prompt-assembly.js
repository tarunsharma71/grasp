import { buildAgentBoundary } from './route-boundary.js';
import { getBoundaryPromptPack, getSurfacePromptPack } from './surface-prompts.js';

function getPageRole(page = {}) {
  return page?.page_role ?? page?.current_role ?? page?.currentRole ?? null;
}

function formatList(items = []) {
  return Array.isArray(items) && items.length > 0
    ? items.map((item) => `- ${item}`).join('\n')
    : '- none';
}

function readWorkspaceSurface(result = {}, route = {}, page = {}) {
  return result?.workspace?.workspace_surface
    ?? result?.snapshot?.workspace_surface
    ?? route?.evidence?.workspace_surface
    ?? page?.workspace_surface
    ?? page?.workspaceSurface
    ?? null;
}

function inferPromptSurfaceKey({ boundaryKey, status, result = {}, route = {}, page = {} } = {}) {
  if (!boundaryKey) return null;

  if (boundaryKey === 'public_read') {
    return getPageRole(page) === 'search' ? 'public_search' : 'public_content';
  }

  if (boundaryKey === 'live_session') {
    return getPageRole(page) === 'auth' ? 'live_auth_session' : 'live_runtime_surface';
  }

  if (boundaryKey === 'session_warmup') {
    return 'session_reentry';
  }

  if (boundaryKey === 'form_runtime') {
    const completionStatus = result?.form?.completion_status ?? null;
    if (completionStatus === 'review_required') return 'form_review_required';
    if (completionStatus === 'ready_to_submit' || completionStatus === 'complete') {
      return 'form_ready_to_submit';
    }
    return 'form_surface';
  }

  if (boundaryKey === 'workspace_runtime') {
    const workspaceSurface = readWorkspaceSurface(result, route, page);
    if (workspaceSurface === 'list') return 'workspace_list';
    if (workspaceSurface === 'detail') return 'workspace_detail';
    if (workspaceSurface === 'thread') return 'workspace_thread';
    if (workspaceSurface === 'composer') return 'workspace_composer';
    if (workspaceSurface === 'loading_shell') return 'workspace_loading_shell';
    return 'workspace_surface';
  }

  if (boundaryKey === 'handoff') {
    return 'checkpoint_handoff';
  }

  if (status === 'gated') {
    return 'checkpoint_handoff';
  }

  return null;
}

function buildSegment(id, lines) {
  return {
    id,
    text: lines.filter(Boolean).join('\n'),
  };
}

export function buildAgentPrompt({
  status,
  page,
  result = {},
  continuation = {},
  route = null,
  agentBoundary = null,
} = {}) {
  const boundary = agentBoundary ?? buildAgentBoundary({
    status,
    page,
    result,
    continuation,
    route,
  });
  if (!boundary) return null;

  const boundaryPack = getBoundaryPromptPack(boundary.key);
  const surfaceKey = inferPromptSurfaceKey({
    boundaryKey: boundary.key,
    status,
    result,
    route,
    page,
  });
  const surfacePack = getSurfacePromptPack(surfaceKey);
  const nextStep = boundary.next_step ?? continuation?.suggested_next_action ?? null;

  const segments = [
    buildSegment('runtime_identity', [
      'You are operating inside Grasp, a route-aware browser runtime.',
      'Respect the current runtime boundary, keep actions explainable, and switch modes only when runtime evidence changes.',
    ]),
    buildSegment(`boundary_${boundary.key}`, [
      `Current boundary: ${boundary.key}`,
      `Boundary summary: ${boundary.summary}`,
      'Preferred tools:',
      formatList(boundary.preferred_tools),
      'Avoid:',
      formatList(boundary.avoid),
      boundary.confirmation ? `Explicit confirmation gate: ${boundary.confirmation}` : null,
    ]),
    boundaryPack
      ? buildSegment(`boundary_pack_${boundaryPack.id}`, [
        `Boundary pack: ${boundaryPack.id}`,
        ...boundaryPack.instructions.map((line) => `- ${line}`),
      ])
      : null,
    surfacePack
      ? buildSegment(`surface_pack_${surfacePack.id}`, [
        `Surface pack: ${surfacePack.id}`,
        ...surfacePack.instructions.map((line) => `- ${line}`),
      ])
      : null,
    buildSegment('next_step', [
      `Next best step: ${nextStep ?? 'unknown'}`,
    ]),
  ].filter(Boolean);

  return {
    boundary_key: boundary.key,
    surface_key: surfaceKey,
    prompt_pack: {
      boundary: boundaryPack?.id ?? boundary.key,
      surface: surfacePack?.id ?? surfaceKey ?? null,
    },
    preferred_tools: [...boundary.preferred_tools],
    avoid: [...boundary.avoid],
    confirmation: boundary.confirmation,
    next_step: nextStep,
    segments,
    system_prompt: segments.map((segment) => segment.text).join('\n\n'),
  };
}
