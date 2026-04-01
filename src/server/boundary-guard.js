import { buildGatewayResponse } from './gateway-response.js';
import { BOUNDARY_MISMATCH } from './error-codes.js';
import {
  buildBoundaryContinuation,
  buildBoundaryMismatchLines,
  inferSurfaceBoundaryKey,
} from './route-boundary.js';

function getBoundaryStatus(status, currentBoundary) {
  if (status === 'handoff_required' || status === 'gated' || status === 'warmup') {
    return status;
  }

  if (currentBoundary === 'session_warmup') {
    return 'warmup';
  }

  return 'blocked';
}

export function guardExpectedBoundary({
  toolName,
  expectedBoundary,
  status,
  page,
  handoffState = 'idle',
} = {}) {
  const currentBoundary = inferSurfaceBoundaryKey({ page });
  if (!currentBoundary || currentBoundary === expectedBoundary) {
    return null;
  }

  const continuation = buildBoundaryContinuation(currentBoundary, handoffState);
  return buildGatewayResponse({
    status: getBoundaryStatus(status, currentBoundary),
    page,
    result: {
      status: 'blocked',
      reason: 'boundary_mismatch',
      expected_boundary: expectedBoundary,
      current_boundary: currentBoundary,
      next_step: continuation.suggested_next_action,
    },
    continuation,
    error_code: BOUNDARY_MISMATCH,
    message: buildBoundaryMismatchLines({
      toolName,
      expectedBoundary,
      currentBoundary,
      nextStep: continuation.suggested_next_action,
    }),
  });
}
