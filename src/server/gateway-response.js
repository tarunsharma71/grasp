import { textResponse } from './responses.js';
import { buildAgentBoundary, buildAgentBoundaryLines } from './route-boundary.js';
import { buildAgentPrompt } from './prompt-assembly.js';

function normalizeLines(value) {
  return Array.isArray(value) ? value : [value];
}

export function buildGatewayResponse({
  status,
  page,
  result = {},
  continuation = {},
  evidence = {},
  runtime = {},
  route = null,
  error_code = null,
  message,
}) {
  const agentBoundary = buildAgentBoundary({
    status,
    page,
    result,
    continuation,
    route,
  });
  const agentPrompt = buildAgentPrompt({
    status,
    page,
    result,
    continuation,
    route,
    agentBoundary,
  });
  const boundaryLines = buildAgentBoundaryLines(agentBoundary);
  const lines = message
    ? [...normalizeLines(message), ...boundaryLines].filter(Boolean)
    : [
        `Status: ${status}`,
        `Page: ${page?.title ?? 'unknown'}`,
        `URL: ${page?.url ?? 'unknown'}`,
        runtime?.instance?.display ? `Instance: ${runtime.instance.display}` : null,
        runtime?.instance?.warning ? `Instance warning: ${runtime.instance.warning}` : null,
        route?.selected_mode ? `Route: ${route.selected_mode}` : null,
        ...boundaryLines,
        result.summary ? `Summary: ${result.summary}` : null,
        continuation.suggested_next_action ? `Next: ${continuation.suggested_next_action}` : null,
      ].filter(Boolean);

  return textResponse(lines, {
    status,
    page,
    result,
    continuation,
    evidence,
    runtime,
    ...(agentBoundary ? { agent_boundary: agentBoundary } : {}),
    ...(agentPrompt ? { agent_prompt: agentPrompt } : {}),
    ...(error_code ? { error_code } : {}),
    ...(route ? { route } : {}),
  });
}
