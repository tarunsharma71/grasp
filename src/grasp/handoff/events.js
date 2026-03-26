import { createHandoffState, mergeHandoffState } from './state.js';

export function requestHandoff(current, reason, note = null, anchors = {}) {
  return mergeHandoffState(current ?? createHandoffState(), {
    state: 'handoff_required',
    reason,
    note,
    requestedAt: Date.now(),
    evidence: null,
    expected_url_contains: anchors.expected_url_contains ?? null,
    expected_page_role: anchors.expected_page_role ?? null,
    expected_selector: anchors.expected_selector ?? null,
    continuation_goal: anchors.continuation_goal ?? null,
    expected_hint_label: anchors.expected_hint_label ?? null,
  });
}

export function markHandoffInProgress(current, note = null) {
  return mergeHandoffState(current ?? createHandoffState(), {
    state: 'handoff_in_progress',
    note,
  });
}

export function markAwaitingReacquisition(current, note = null) {
  return mergeHandoffState(current ?? createHandoffState(), {
    state: 'awaiting_reacquisition',
    note,
  });
}

export function markResumedUnverified(current, evidence = null, note = null) {
  return mergeHandoffState(current ?? createHandoffState(), {
    state: 'resumed_unverified',
    evidence,
    note,
  });
}

export function markResumeVerified(current, evidence = null, note = null) {
  return mergeHandoffState(current ?? createHandoffState(), {
    state: 'resumed_verified',
    evidence,
    note,
    verifiedAt: Date.now(),
  });
}

export function clearHandoff(current) {
  return mergeHandoffState(current ?? createHandoffState(), {
    state: 'idle',
    reason: null,
    note: null,
    requestedAt: null,
    verifiedAt: null,
    evidence: null,
    expected_url_contains: null,
    expected_page_role: null,
    expected_selector: null,
    continuation_goal: null,
    expected_hint_label: null,
    taskId: null,
    siteKey: null,
    sessionKey: null,
    lastUrl: null,
  });
}
