export function createHandoffState() {
  return {
    state: 'idle', // idle | handoff_required | handoff_in_progress | awaiting_reacquisition | resumed_unverified | resumed_verified
    reason: null,
    note: null,
    requestedAt: null,
    updatedAt: Date.now(),
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
  };
}

export function mergeHandoffState(base, patch = {}) {
  return {
    ...base,
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  };
}
