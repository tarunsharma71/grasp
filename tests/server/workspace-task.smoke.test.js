import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakePage } from '../helpers/fake-page.js';
import { assessGatewayContinuation } from '../../src/server/continuity.js';

const confirmedInstance = {
  browser: 'Chrome/136.0.7103.114',
  protocolVersion: '1.3',
  headless: false,
  display: 'windowed',
  warning: null,
};

const confirmedRuntime = {
  instance_key: 'windowed|Chrome/136.0.7103.114|1.3',
  display: 'windowed',
  browser: 'Chrome/136.0.7103.114',
  protocolVersion: '1.3',
  confirmed_at: 0,
};

function registerWorkspaceToolsWithSnapshot(snapshot, deps = {}, stateOverrides = {}) {
  return async () => {
    const { registerWorkspaceTools } = await import('../../src/server/tools.workspace.js');
    const calls = [];
    const server = { registerTool(name, spec, handler) { calls.push({ name, handler }); } };
    const state = {
      pageState: { currentRole: 'workspace', workspaceSurface: 'thread', graspConfidence: 'high', riskGateDetected: false },
      handoff: { state: 'idle' },
      runtimeConfirmation: { ...confirmedRuntime },
      ...stateOverrides,
    };

    registerWorkspaceTools(server, state, {
      getActivePage: async () => createFakePage({
        url: () => 'https://example.com/workspace',
        title: () => 'Workspace',
      }),
      syncPageState: async () => undefined,
      collectVisibleWorkspaceSnapshot: async () => snapshot,
      getBrowserInstance: async () => confirmedInstance,
      ...deps,
    });

    return { calls, state };
  };
}

test('authenticated workspace thread summary plus item select and draft', async () => {
  const initialSnapshot = {
    workspace_surface: 'thread',
    live_items: [{ label: '李女士', selected: false, hint_id: 'L1', normalized_label: '李女士' }],
    active_item: null,
    composer: { kind: 'chat_composer', hint_id: 'C1', draft_present: false },
    action_controls: [{ label: '发送', action_kind: 'send', hint_id: 'B1' }],
    blocking_modals: [],
    loading_shell: false,
    summary: { active_item_label: null, draft_present: false, loading_shell: false },
  };
  const selectedSnapshot = {
    ...initialSnapshot,
    live_items: [{ label: '李女士', selected: true, hint_id: 'L1', normalized_label: '李女士' }],
    active_item: { label: '李女士', hint_id: 'L1', normalized_label: '李女士', selected: true },
    summary: { active_item_label: '李女士', draft_present: false, loading_shell: false },
  };
  let snapshotCalls = 0;

  const { calls } = await registerWorkspaceToolsWithSnapshot(initialSnapshot, {
    collectVisibleWorkspaceSnapshot: async () => {
      snapshotCalls += 1;
      return snapshotCalls === 1 ? initialSnapshot : selectedSnapshot;
    },
    selectLiveItem: async () => ({
      ok: true,
    }),
    draftWorkspaceAction: async (_runtime, text) => ({
      status: 'drafted',
      draft_present: true,
      draft_evidence: { kind: 'draft_action', target: 'chat_composer', draft_present: true, summary: text },
      snapshot: {
        ...initialSnapshot,
        live_items: [{ label: '李女士', selected: true, hint_id: 'L1', normalized_label: '李女士' }],
        active_item: { label: '李女士', hint_id: 'L1', normalized_label: '李女士', selected: true },
        composer: { kind: 'chat_composer', hint_id: 'C1', draft_present: true, draft_text: text },
        summary: { active_item_label: '李女士', draft_present: true, loading_shell: false },
      },
    }),
  })();

  const inspect = await calls.find((entry) => entry.name === 'workspace_inspect').handler({});
  const selectLiveItem = await calls.find((entry) => entry.name === 'select_live_item').handler({ item: '李女士' });
  const draftAction = await calls.find((entry) => entry.name === 'draft_action').handler({ text: '你好，我想咨询一下岗位情况。' });

  assert.equal(inspect.meta.result.task_kind, 'workspace');
  assert.equal(inspect.meta.continuation.suggested_next_action, 'select_live_item');
  assert.equal(selectLiveItem.meta.result.status, 'selected');
  assert.equal(selectLiveItem.meta.result.selected_item.label, '李女士');
  assert.equal(selectLiveItem.meta.continuation.suggested_next_action, 'workspace_inspect');
  assert.equal(draftAction.meta.result.status, 'drafted');
  assert.equal(draftAction.meta.result.snapshot.composer.draft_present, true);
  assert.equal(draftAction.meta.continuation.suggested_next_action, 'workspace_inspect');
});

test('guarded workspace execute preview plus verified outcome', async () => {
  const baseSnapshot = {
    workspace_surface: 'thread',
    live_items: [{ label: '李女士', selected: true, hint_id: 'L1', normalized_label: '李女士' }],
    active_item: { label: '李女士', hint_id: 'L1', normalized_label: '李女士', selected: true },
    composer: { kind: 'chat_composer', hint_id: 'C1', draft_present: true, draft_text: '你好' },
    action_controls: [{ label: '发送', action_kind: 'send', hint_id: 'B1' }],
    blocking_modals: [],
    loading_shell: false,
    summary: { active_item_label: '李女士', draft_present: true, loading_shell: false },
  };
  const sentSnapshot = {
    ...baseSnapshot,
    composer: { kind: 'chat_composer', hint_id: 'C1', draft_present: false, draft_text: '' },
    summary: { active_item_label: '李女士', draft_present: false, loading_shell: false },
    outcome_signals: { delivered: true, composer_cleared: true, active_item_stable: true },
  };
  let snapshotCalls = 0;

  const { calls } = await registerWorkspaceToolsWithSnapshot(baseSnapshot, {
    collectVisibleWorkspaceSnapshot: async () => {
      snapshotCalls += 1;
      return snapshotCalls <= 3 ? baseSnapshot : sentSnapshot;
    },
    executeWorkspaceAction: async (_runtime, params) => {
      if (params.mode === 'preview') {
        return {
          status: 'blocked',
          blocked: true,
          executed: false,
          reason: 'preview_safe',
          unresolved: null,
          failure: null,
          action: { kind: 'execute_action', status: 'blocked' },
          snapshot: baseSnapshot,
          workspace: null,
          summary: null,
        };
      }

      return {
        status: 'success',
        blocked: false,
        executed: true,
        reason: null,
        unresolved: null,
        failure: null,
        verification: { delivered: true, composer_cleared: true, active_item_stable: true },
        action: { kind: 'execute_action', status: 'executed' },
        snapshot: sentSnapshot,
        workspace: null,
        summary: 'Workspace thread • 李女士',
      };
    },
  })();

  const executeAction = calls.find((entry) => entry.name === 'execute_action');
  const verifyOutcome = calls.find((entry) => entry.name === 'verify_outcome');
  const preview = await executeAction.handler({ action: 'send', mode: 'preview' });
  const confirm = await executeAction.handler({ action: 'send', mode: 'confirm', confirmation: 'EXECUTE' });
  const verification = await verifyOutcome.handler({});

  assert.equal(preview.meta.result.blocked, true);
  assert.equal(preview.meta.result.reason, 'preview_safe');
  assert.equal(preview.meta.continuation.suggested_next_action, 'verify_outcome');
  assert.equal(confirm.meta.result.status, 'success');
  assert.equal(confirm.meta.result.verification.delivered, true);
  assert.equal(confirm.meta.continuation.suggested_next_action, 'verify_outcome');
  assert.equal(verification.meta.result.verification.delivered, true);
  assert.equal(verification.meta.continuation.suggested_next_action, 'draft_action');
});

test('resumed workspace continuation lands on workspace_inspect', async () => {
  const page = createFakePage({
    url: () => 'https://example.com/workspace/thread',
    title: () => 'Workspace',
  });
  const state = {
    pageState: { currentRole: 'workspace', workspaceSurface: 'thread', graspConfidence: 'high', riskGateDetected: false },
    handoff: {
      state: 'resumed_verified',
      expected_url_contains: 'example.com',
      continuation_goal: 'resume workspace task',
    },
  };

  const outcome = await assessGatewayContinuation(page, state);

  assert.equal(outcome.status, 'resumed');
  assert.equal(outcome.continuation.can_continue, true);
  assert.equal(outcome.continuation.suggested_next_action, 'workspace_inspect');
});
