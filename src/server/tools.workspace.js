import { buildGatewayResponse } from './gateway-response.js';
import { getActivePage } from '../layer1-bridge/chrome.js';
import { syncPageState } from './state.js';
import { collectVisibleWorkspaceSnapshot, getWorkspaceContinuation, getWorkspaceStatus, summarizeWorkspaceSnapshot } from './workspace-tasks.js';

function toGatewayPage(page, state) {
  return {
    title: page.title,
    url: page.url,
    page_role: state.pageState?.currentRole ?? 'unknown',
    grasp_confidence: state.pageState?.graspConfidence ?? 'unknown',
    risk_gate: state.pageState?.riskGateDetected ?? false,
  };
}

function pick(snapshot, camelKey, snakeKey, fallback = null) {
  if (snapshot?.[camelKey] !== undefined) return snapshot[camelKey];
  if (snapshot?.[snakeKey] !== undefined) return snapshot[snakeKey];
  return fallback;
}

function getLiveItems(snapshot) {
  const items = pick(snapshot, 'liveItems', 'live_items', []);
  return Array.isArray(items) ? items : [];
}

function getComposer(snapshot) {
  const composer = pick(snapshot, 'composer', 'composer', null);
  return composer && typeof composer === 'object' ? composer : null;
}

function getActionControls(snapshot) {
  const controls = pick(snapshot, 'actionControls', 'action_controls', []);
  return Array.isArray(controls) ? controls : [];
}

function getBlockingModals(snapshot) {
  const modals = pick(snapshot, 'blockingModals', 'blocking_modals', []);
  return Array.isArray(modals) ? modals : [];
}

function getLoadingShell(snapshot) {
  return pick(snapshot, 'loadingShell', 'loading_shell', false) === true;
}

function getActiveItem(snapshot) {
  return pick(snapshot, 'activeItem', 'active_item', null);
}

function isActiveItemStable(snapshot, summary) {
  if (summary?.outcome_signals?.active_item_stable === true) {
    return true;
  }

  if (summary?.active_item_stable === true) {
    return true;
  }

  return false;
}

function getWorkspaceNextAction(snapshot) {
  const summary = pick(snapshot, 'summary', 'summary', null);
  const loadingShell = getLoadingShell(snapshot) || summary?.loading_shell === true;
  if (loadingShell) {
    return 'workspace_inspect';
  }

  const liveItems = getLiveItems(snapshot);
  const activeItem = getActiveItem(snapshot);
  const composer = getComposer(snapshot);
  const activeItemStable = isActiveItemStable(snapshot, summary);
  const draftPresent = composer?.draft_present === true || summary?.draft_present === true;

  if (!activeItem && liveItems.length > 0) {
    return 'select_live_item';
  }

  if (composer && activeItemStable && draftPresent) {
    return 'execute_action';
  }

  if (composer && activeItemStable) {
    return 'draft_action';
  }

  if (liveItems.length > 0) {
    return 'select_live_item';
  }

  return 'workspace_inspect';
}

function buildWorkspaceSnapshotView(snapshot) {
  const workspaceSummary = snapshot.summary ?? summarizeWorkspaceSnapshot(snapshot);
  const workspaceSurface = snapshot.workspace_surface ?? snapshot.workspaceSurface ?? workspaceSummary.workspace_surface;

  return {
    workspaceSummary,
    workspaceSurface,
    workspace: {
      workspace_surface: workspaceSurface,
      live_items: getLiveItems(snapshot),
      active_item: getActiveItem(snapshot),
      composer: getComposer(snapshot),
      action_controls: getActionControls(snapshot),
      blocking_modals: getBlockingModals(snapshot),
      loading_shell: getLoadingShell(snapshot),
      summary: workspaceSummary,
    },
  };
}

async function loadWorkspacePageContext(page, state, syncState, collectSnapshot) {
  await syncState(page, state, { force: true });
  const snapshot = await collectSnapshot(page, state);
  const pageInfo = {
    title: await page.title(),
    url: page.url(),
  };

  return {
    pageInfo,
    snapshot,
    ...buildWorkspaceSnapshotView(snapshot),
  };
}

function registerWorkspaceActionTool(server, state, deps, toolName, actionKind) {
  const getPage = deps.getActivePage ?? getActivePage;
  const syncState = deps.syncPageState ?? syncPageState;
  const collectSnapshot = deps.collectVisibleWorkspaceSnapshot ?? collectVisibleWorkspaceSnapshot;

  server.registerTool(
    toolName,
    {
      description: `Placeholder workspace action for ${actionKind}.`,
      inputSchema: {},
    },
    async () => {
      const page = await getPage();
      const { pageInfo, workspace, workspaceSummary, workspaceSurface } = await loadWorkspacePageContext(page, state, syncState, collectSnapshot);
      const status = getWorkspaceStatus(state);
      const continuationAction = status === 'direct' ? actionKind : 'request_handoff';

      return buildGatewayResponse({
        status,
        page: toGatewayPage(pageInfo, state),
        result: {
          task_kind: 'workspace',
          action: {
            kind: actionKind,
            status: status === 'direct' ? 'unimplemented' : 'blocked',
          },
          workspace,
          summary: `Workspace ${workspaceSurface} • ${workspaceSummary.active_item_label ?? 'no active item'}`,
        },
        continuation: getWorkspaceContinuation(state, continuationAction),
        evidence: {
          workspace_surface: workspaceSurface,
          active_item_label: workspaceSummary.active_item_label ?? null,
          loading_shell: workspaceSummary.loading_shell ?? false,
          blocking_modal_count: workspaceSummary.blocking_modal_count ?? 0,
        },
      });
    }
  );
}

export function registerWorkspaceTools(server, state, deps = {}) {
  const getPage = deps.getActivePage ?? getActivePage;
  const syncState = deps.syncPageState ?? syncPageState;
  const collectSnapshot = deps.collectVisibleWorkspaceSnapshot ?? collectVisibleWorkspaceSnapshot;

  server.registerTool(
    'workspace_inspect',
    {
      description: 'Inspect the current workspace surface, live items, and composer state.',
      inputSchema: {},
    },
    async () => {
      const page = await getPage();
      const { pageInfo, snapshot, workspace, workspaceSummary, workspaceSurface } = await loadWorkspacePageContext(page, state, syncState, collectSnapshot);

      return buildGatewayResponse({
        status: getWorkspaceStatus(state),
        page: toGatewayPage(pageInfo, state),
        result: {
          task_kind: 'workspace',
          workspace,
          summary: `Workspace ${workspaceSurface} • ${workspaceSummary.active_item_label ?? 'no active item'}`,
        },
        continuation: getWorkspaceContinuation(state, getWorkspaceNextAction(snapshot)),
        evidence: {
          workspace_surface: workspaceSurface,
          active_item_label: workspaceSummary.active_item_label ?? null,
          loading_shell: workspaceSummary.loading_shell ?? getLoadingShell(snapshot),
          blocking_modal_count: workspaceSummary.blocking_modal_count ?? getBlockingModals(snapshot).length,
        },
      });
    }
  );

  registerWorkspaceActionTool(server, state, deps, 'select_live_item', 'select_live_item');
  registerWorkspaceActionTool(server, state, deps, 'draft_action', 'draft_action');
  registerWorkspaceActionTool(server, state, deps, 'execute_action', 'execute_action');
}
