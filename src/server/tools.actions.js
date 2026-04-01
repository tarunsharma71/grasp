import { z } from 'zod';

import { getActivePage, getTabs, navigateTo, switchTab } from '../layer1-bridge/chrome.js';
import { clickByHintId, typeByHintId, hoverByHintId, pressKey, watchElement, scroll, findScrollableAncestor } from '../layer3-action/actions.js';
import { errorResponse, textResponse } from './responses.js';
import { describeMode, syncPageState } from './state.js';
import { audit } from './audit.js';
import { verifyTypeResult, verifyGenericAction } from './postconditions.js';
import { TYPE_FAILED } from './error-codes.js';
import { runVerifiedAction } from '../grasp/verify/pipeline.js';
import { readHandoffState } from '../grasp/handoff/persist.js';
import { extractMainContent } from './content.js';
import { readFastPath } from './fast-path-router.js';
import { buildPageProjection } from './page-projection.js';
import { selectEngine } from './engine-selection.js';
import { readLatestRouteDecision } from './audit.js';
import { readBrowserInstance } from '../runtime/browser-instance.js';
import { buildRuntimeConfirmationSuccessResponse, getRuntimeConfirmationSummary, requireConfirmedRuntimeInstance, storeRuntimeConfirmation } from './runtime-confirmation.js';

function buildStructuredError(message, normalizedHintId, verdict) {
  const meta = {
    error_code: verdict?.error_code ?? TYPE_FAILED,
    retryable: verdict?.retryable ?? true,
    suggested_next_step: verdict?.suggested_next_step ?? 'retry',
    evidence: verdict?.evidence ?? { hint_id: normalizedHintId },
  };
  return errorResponse(message, meta);
}

function createRebuildHints(page, state) {
  return async () => {
    await syncPageState(page, state, { force: true });
    return null;
  };
}

function normalizeQuery(value) {
  return String(value ?? '').trim().toLowerCase();
}

function listUserTabs(tabs = [], activeUrl) {
  return tabs
    .filter((tab) => tab.isUser)
    .map((tab) => ({
      ...tab,
      active: tab.url === activeUrl,
    }));
}

function matchVisibleTabs(tabs = [], { query = '', title_contains = '', url_contains = '' } = {}) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedTitle = normalizeQuery(title_contains);
  const normalizedUrl = normalizeQuery(url_contains);

  return tabs.filter((tab) => {
    const title = normalizeQuery(tab.title);
    const url = normalizeQuery(tab.url);
    if (normalizedTitle && !title.includes(normalizedTitle)) return false;
    if (normalizedUrl && !url.includes(normalizedUrl)) return false;
    if (!normalizedQuery) return true;
    return title.includes(normalizedQuery) || url.includes(normalizedQuery);
  });
}

export function registerActionTools(server, state, deps = {}) {
  const getPage = deps.getActivePage ?? getActivePage;
  const listTabs = deps.getTabs ?? getTabs;
  const activateTab = deps.switchTab ?? switchTab;
  const syncState = deps.syncPageState ?? syncPageState;
  const extractContent = deps.extractMainContent ?? extractMainContent;
  const navigate = deps.navigateTo ?? navigateTo;
  const getBrowserInstance = deps.getBrowserInstance ?? (() => readBrowserInstance(process.env.CHROME_CDP_URL || 'http://localhost:9222'));
  const readFastPathContent = deps.readFastPath ?? readFastPath;

  server.registerTool(
    'list_visible_tabs',
    {
      description: 'List user-visible tabs in the current runtime and mark which one is active.',
      inputSchema: {},
    },
    async () => {
      const page = await getPage({ state });
      const tabs = listUserTabs(await listTabs(), page.url());

      return textResponse([
        `Visible tabs: ${tabs.length}`,
        '',
        ...tabs.map((tab) => `[${tab.index}] ${tab.title}${tab.active ? ' (active)' : ''}\n${tab.url}`),
      ], { tabs });
    }
  );

  server.registerTool(
    'select_visible_tab',
    {
      description: 'Bring a visible runtime tab to the front by matching its title or URL fragment.',
      inputSchema: {
        query: z.string().optional().describe('Text fragment that may match either the tab title or the tab URL'),
        title_contains: z.string().optional().describe('Optional title fragment to narrow tab selection'),
        url_contains: z.string().optional().describe('Optional URL fragment to narrow tab selection'),
      },
    },
    async ({ query = '', title_contains = '', url_contains = '' } = {}) => {
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'select_visible_tab');
      if (confirmationError) return confirmationError;

      const tabs = listUserTabs(await listTabs());
      const matches = matchVisibleTabs(tabs, { query, title_contains, url_contains });

      if (matches.length === 0) {
        return errorResponse('No visible tab matched the provided query.', {
          error_code: 'TAB_NOT_FOUND',
          retryable: true,
          suggested_next_step: 'list_visible_tabs',
          tabs,
        });
      }

      if (matches.length > 1) {
        return errorResponse('Multiple visible tabs matched the provided query.', {
          error_code: 'TAB_AMBIGUOUS',
          retryable: true,
          suggested_next_step: 'list_visible_tabs',
          candidates: matches,
        });
      }

      const selectedTab = matches[0];
      const page = await activateTab(selectedTab.index);
      await syncState(page, state, { force: true });

      return textResponse([
        `Selected tab [${selectedTab.index}]: ${selectedTab.title}`,
        `URL: ${selectedTab.url}`,
        `Page role: ${state.pageState?.currentRole ?? 'unknown'}`,
      ], { tab: selectedTab });
    }
  );

  server.registerTool(
    'confirm_runtime_instance',
    {
      description: 'Confirm the current runtime browser instance before performing page-changing actions.',
      inputSchema: {
        display: z.enum(['windowed', 'headless', 'unknown']).describe('The runtime instance mode you expect to act against'),
      },
    },
    async ({ display }) => {
      const instance = await getBrowserInstance();
      if (!instance) {
        return errorResponse('Runtime instance unavailable. Call get_status and try again.');
      }
      if ((instance.display ?? 'unknown') !== display) {
        return errorResponse([
          'Runtime instance mismatch.',
          `Expected: ${display}`,
          `Actual: ${instance.display ?? 'unknown'}`,
          ...(instance.browser ? [`Browser: ${instance.browser}`] : []),
        ], {
          error_code: 'INSTANCE_CONFIRMATION_MISMATCH',
          retryable: true,
          suggested_next_step: 'get_status',
          instance,
        });
      }
      const confirmation = storeRuntimeConfirmation(state, instance);
      return buildRuntimeConfirmationSuccessResponse(confirmation, instance);
    }
  );

  server.registerTool(
    'navigate',
    {
      description: 'Navigate the browser to a URL and refresh Grasp page state.',
      inputSchema: { url: z.string().url().describe('Full URL to navigate to') },
    },
    async ({ url }) => {
      try {
        const instance = await getBrowserInstance();
        const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'navigate');
        if (confirmationError) return confirmationError;
        const page = await navigate(url, { state });
        await syncState(page, state, { force: true });
        await audit('navigate', url, null, state);
        return textResponse([
          `Navigated to: ${url}`,
          `Page title: ${await page.title()}`,
          `CDP mode - ${state.hintMap.length} interactive elements found.`,
          'Use get_hint_map to inspect the current interaction map.',
        ]);
      } catch (err) {
        return errorResponse(`Navigation failed: ${err.message}`);
      }
    }
  );

  server.registerTool(
    'get_status',
    {
      description: 'Get current Grasp status, including page grasp and handoff state.',
      inputSchema: {},
    },
    async () => {
      try {
        const page = await getPage({ state });
        await syncState(page, state);
        state.handoff = await readHandoffState();
        const handoff = state.handoff ?? { state: 'idle' };
        const pageState = state.pageState ?? {};
        const route = state.lastRouteTrace ?? await readLatestRouteDecision();
        const { mode, detail } = describeMode(state);
        const instance = await getBrowserInstance();
        const confirmation = getRuntimeConfirmationSummary(state, instance);

        return textResponse([
          'Grasp is connected',
          '',
          `Page: ${await page.title()}`,
          `URL: ${page.url()}`,
          `Mode: ${mode}`,
          `  ${detail}`,
          ...(instance?.browser ? [`Browser instance: ${instance.browser}`] : []),
          ...(instance?.display ? [`Instance mode: ${instance.display}`] : []),
          ...(instance?.warning ? [`Instance warning: ${instance.warning}`] : []),
          `Instance confirmed: ${confirmation.confirmed ? 'yes' : 'no'}`,
          `Hint Map: ${state.hintMap?.length ?? 0} elements cached`,
          `Page role: ${pageState.currentRole ?? 'unknown'}`,
          `Grasp confidence: ${pageState.graspConfidence ?? 'unknown'}`,
          `Reacquired: ${pageState.reacquired ? 'yes' : 'no'}`,
          `Risk gate detected: ${pageState.riskGateDetected ? 'yes' : 'no'}`,
          ...(pageState.checkpointKind ? [`Checkpoint kind: ${pageState.checkpointKind}`] : []),
          ...(pageState.checkpointSignals?.length ? [`Checkpoint signals: ${pageState.checkpointSignals.join(', ')}`] : []),
          ...(pageState.suggestedNextAction ? [`Suggested next action: ${pageState.suggestedNextAction}`] : []),
          ...(route?.selected_mode ? [`Last route: ${route.selected_mode}`] : []),
          ...(route?.next_step ? [`Route next step: ${route.next_step}`] : []),
          `Handoff: ${handoff.state}`,
          ...(handoff.reason ? [`  reason: ${handoff.reason}`] : []),
        ], { handoff, pageState, ...(instance ? { instance } : {}), ...(route ? { route } : {}) });
      } catch (err) {
        return errorResponse(`Grasp is NOT connected.\n${err.message}`);
      }
    }
  );

  server.registerTool(
    'get_page_summary',
    {
      description: 'Extract a concise summary of the current page.',
      inputSchema: {},
    },
    async () => {
      const page = await getPage({ state });
      const selection = selectEngine({ tool: 'get_page_summary', url: page.url() });
      let fastPath = null;

      if (selection.engine === 'runtime') {
        await syncState(page, state, { force: true });
        fastPath = await readFastPathContent(page);
      } else {
        await syncState(page, state);
      }

      const main = fastPath ?? await extractContent(page);
      const result = buildPageProjection({
        ...selection,
        surface: fastPath?.surface ?? 'content',
        title: main.title,
        url: fastPath?.url ?? page.url(),
        mainText: fastPath?.mainText ?? main.text,
      });
      const { summary } = describeMode(state);
      return textResponse([
        `Title: ${result.title}`,
        `URL: ${result.url}`,
        `Mode: ${summary}`,
        '',
        'Visible content (truncated):',
        result.main_text.slice(0, 2000),
      ], { result });
    }
  );

  server.registerTool(
    'get_hint_map',
    {
      description: 'Return the current Hint Map for interactive elements on the page.',
      inputSchema: {
        filter: z.string().optional().describe('Optional text filter for hint labels'),
      },
    },
    async ({ filter } = {}) => {
      const page = await getPage({ state });
      await syncPageState(page, state, { force: true });
      const query = (filter ?? '').trim().toLowerCase();
      const hints = query
        ? state.hintMap.filter((hint) => hint.label.toLowerCase().includes(query))
        : state.hintMap;

      if (hints.length === 0) {
        return textResponse(query ? `No hints matched filter: ${filter}` : 'No interactive elements found.');
      }

      return textResponse([
        `Hint Map (${hints.length} elements):`,
        '',
        ...hints.map((hint) => `[${hint.id}] ${hint.label} (${hint.type}, pos:${hint.x},${hint.y})`),
      ], { hints });
    }
  );

  server.registerTool(
    'click',
    {
      description: 'Click an element by hint ID and verify the result.',
      inputSchema: {
        hint_id: z.string().describe('Hint ID from get_hint_map'),
      },
    },
    async ({ hint_id }) => {
      const normalizedHintId = String(hint_id).trim();
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'click');
      if (confirmationError) return confirmationError;
      const page = await getPage({ state });
      await syncPageState(page, state);
      const prevDomRevision = state.pageState?.domRevision ?? 0;
      const prevUrl = page.url();
      const prevActiveId = await page.evaluate(() => document.activeElement?.getAttribute('data-grasp-id') ?? null);
      const rebuildHints = createRebuildHints(page, state);

      return runVerifiedAction({
        action: 'click',
        page,
        state,
        baseEvidence: { hint_id: normalizedHintId },
        execute: async () => {
          const result = await clickByHintId(page, normalizedHintId, { rebuildHints });
          await syncPageState(page, state, { force: true });
          return result;
        },
        verify: async () => verifyGenericAction({
          page,
          hintId: normalizedHintId,
          prevDomRevision,
          prevUrl,
          prevActiveId,
          newDomRevision: state.pageState?.domRevision ?? 0,
        }),
        onFailure: async (failure) => {
          await audit('click_failed', `[${normalizedHintId}] ${failure.error_code}`, null, state);
          return buildStructuredError(`Click verification failed for [${normalizedHintId}]`, normalizedHintId, failure);
        },
        onSuccess: async ({ executionResult, evidence }) => {
          await audit('click', `[${normalizedHintId}] "${executionResult.label}"`, null, state);
          const urlAfter = page.url();
          const nav = urlAfter !== prevUrl ? `\nNavigated to: ${urlAfter}` : '';
          return textResponse(
            `Clicked [${normalizedHintId}]: "${executionResult.label}"${nav}\nPage now has ${state.hintMap.length} elements. Call get_hint_map to inspect the new state.`,
            { evidence }
          );
        },
      });
    }
  );

  server.registerTool(
    'type',
    {
      description: 'Type text into an element by hint ID and verify the result.',
      inputSchema: {
        hint_id: z.string().describe('Hint ID from get_hint_map'),
        text: z.string().describe('Text to type'),
        press_enter: z.boolean().optional().describe('Press Enter after typing'),
      },
    },
    async ({ hint_id, text, press_enter = false }) => {
      const normalizedHintId = String(hint_id).trim();
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'type');
      if (confirmationError) return confirmationError;
      const page = await getPage({ state });
      await syncPageState(page, state);
      const prevDomRevision = state.pageState?.domRevision ?? 0;
      const prevUrl = page.url();
      const rebuildHints = createRebuildHints(page, state);

      return runVerifiedAction({
        action: 'type',
        page,
        state,
        baseEvidence: { hint_id: normalizedHintId },
        execute: async () => {
          await typeByHintId(page, normalizedHintId, text, press_enter, { rebuildHints });
          await syncPageState(page, state, { force: true });
          return { text, press_enter };
        },
        verify: async () => {
          const newDomRevision = state.pageState?.domRevision ?? prevDomRevision;
          return verifyTypeResult({
            page,
            expectedText: text,
            allowPageChange: press_enter,
            prevUrl,
            prevDomRevision,
            newDomRevision,
          });
        },
        onFailure: async (failure) => {
          await audit('type_failed', `[${normalizedHintId}] ${failure.error_code}`, null, state);
          return buildStructuredError(`Type verification failed for [${normalizedHintId}]`, normalizedHintId, failure);
        },
        onSuccess: async ({ executionResult, evidence }) => {
          await audit('type', `[${normalizedHintId}] "${executionResult.text.slice(0, 20)}${executionResult.text.length > 20 ? '...' : ''}"`, null, state);
          return textResponse(
            `Typed "${executionResult.text}" into [${normalizedHintId}]${executionResult.press_enter ? ' and pressed Enter' : ''}.`,
            { evidence }
          );
        },
      });
    }
  );

  server.registerTool(
    'hover',
    {
      description: 'Hover an element by hint ID and refresh page state.',
      inputSchema: {
        hint_id: z.string().describe('Hint ID from get_hint_map'),
      },
    },
    async ({ hint_id }) => {
      const normalizedHintId = String(hint_id).trim();
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'hover');
      if (confirmationError) return confirmationError;
      const page = await getPage({ state });
      await syncPageState(page, state);
      const prevUrl = page.url();
      const rebuildHints = createRebuildHints(page, state);

      try {
        const result = await hoverByHintId(page, normalizedHintId, { rebuildHints });
        await syncPageState(page, state, { force: true });
        await audit('hover', `[${normalizedHintId}] "${result.label}"`, null, state);
        const urlAfter = page.url();
        const nav = urlAfter !== prevUrl ? `\nNavigated to: ${urlAfter}` : '';
        return textResponse(
          `Hovered over [${normalizedHintId}]: "${result.label}".${nav}\n${state.hintMap.length} elements now visible.`,
          { hint_id: normalizedHintId }
        );
      } catch (err) {
        await audit('hover_failed', `[${normalizedHintId}] ${err.message}`, null, state);
        await syncPageState(page, state, { force: true });
        return buildStructuredError(`hover failed: ${err.message}`, normalizedHintId, {
          error_code: TYPE_FAILED,
          retryable: true,
          suggested_next_step: 'retry',
          evidence: {
            hint_id: normalizedHintId,
            reason: err.message,
          },
        });
      }
    }
  );

  server.registerTool(
    'press_key',
    {
      description: 'Press a keyboard key or shortcut and refresh page state.',
      inputSchema: {
        key: z.string().describe('Keyboard key or shortcut, e.g. Enter, Escape, Control+Enter'),
      },
    },
    async ({ key }) => {
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'press_key');
      if (confirmationError) return confirmationError;
      const page = await getPage({ state });
      await syncPageState(page, state);
      await pressKey(page, key);
      await syncPageState(page, state, { force: true });
      await audit('press_key', key, null, state);
      return textResponse(`Pressed key: ${key}`, {
        key,
        page_role: state.pageState?.currentRole ?? 'unknown',
        grasp_confidence: state.pageState?.graspConfidence ?? 'unknown',
      });
    }
  );

  server.registerTool(
    'watch_element',
    {
      description: 'Watch a DOM element for appears/disappears/changes and report the result.',
      inputSchema: {
        selector: z.string().describe('CSS selector to watch'),
        condition: z.enum(['appears', 'disappears', 'changes']).optional().describe('Condition to watch for'),
        timeout_ms: z.number().int().positive().optional().describe('Timeout in milliseconds'),
      },
    },
    async ({ selector, condition = 'appears', timeout_ms = 30000 }) => {
      const page = await getPage({ state });
      const result = await watchElement(page, selector, condition, timeout_ms);
      await audit('watch_element', `${condition} ${selector}`, null, state);
      return textResponse([
        `Watch selector: ${selector}`,
        `Condition: ${condition}`,
        `Result: ${result.met ? 'met' : result.timeout ? 'timeout' : 'unknown'}`,
        ...(result.text ? [`Text: ${result.text}`] : []),
      ], { selector, condition, result });
    }
  );

  server.registerTool(
    'scroll',
    {
      description: 'Scroll the page or a specific container by pixel amount. Use hint_id to scroll a nested scrollable area (e.g. sidebar, chat list) instead of the whole page. Returns scroll position (scrollTop/scrollHeight). NOTE: If your goal is to make a known element visible, use scroll_into_view instead — it is a single call and much more accurate.',
      inputSchema: {
        direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
        amount: z.number().int().positive().optional().describe('Scroll distance in pixels (default: 600). Use small values like 50-150 for precise scrolling.'),
        hint_id: z.string().optional().describe('Hint ID of an element inside the scrollable container to target'),
      },
    },
    async ({ direction, amount = 600, hint_id }) => {
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'scroll');
      if (confirmationError) return confirmationError;
      const page = await getPage({ state });
      await syncState(page, state);

      let scrollTarget = null;
      let scrollOptions = {};

      if (hint_id) {
        const normalizedId = String(hint_id).trim();
        const selector = `[data-grasp-id="${normalizedId}"]`;
        const ancestorSelector = await findScrollableAncestor(page, selector);
        if (ancestorSelector) {
          scrollOptions.selector = ancestorSelector;
          scrollTarget = ancestorSelector;
        }
      }

      await scroll(page, direction, amount, scrollOptions);
      await syncState(page, state, { force: true });

      const scrollInfo = await page.evaluate((sel) => {
        const target = sel ? document.querySelector(sel) : document.documentElement;
        if (!target) return null;
        return {
          scrollTop: Math.round(target.scrollTop),
          scrollHeight: Math.round(target.scrollHeight),
          clientHeight: Math.round(target.clientHeight),
          atTop: target.scrollTop <= 0,
          atBottom: target.scrollTop + target.clientHeight >= target.scrollHeight - 1,
        };
      }, scrollTarget);

      const targetLabel = scrollTarget ? `container ${scrollTarget}` : 'page';
      await audit('scroll', `${direction} ${amount} target=${targetLabel}`, null, state);

      const posInfo = scrollInfo
        ? ` Position: ${scrollInfo.scrollTop}/${scrollInfo.scrollHeight}px.${scrollInfo.atTop ? ' [AT TOP]' : ''}${scrollInfo.atBottom ? ' [AT BOTTOM]' : ''}`
        : '';
      return textResponse(
        `Scrolled ${targetLabel} ${direction} by ${amount}px.${posInfo}`,
        {
          direction,
          amount,
          target: scrollTarget ?? 'page',
          ...(scrollInfo ?? {}),
          page_role: state.pageState?.currentRole ?? 'unknown',
          grasp_confidence: state.pageState?.graspConfidence ?? 'unknown',
          dom_revision: state.pageState?.domRevision ?? 0,
        }
      );
    }
  );

  server.registerTool(
    'scroll_into_view',
    {
      description: 'Scroll the page or container so that a specific element becomes visible in the viewport. Uses browser-native scrollIntoView which automatically handles arbitrarily nested scrollable containers in one call. PREFERRED over scroll() when you need to locate a known element — no pixel estimation or evaluate() needed.',
      inputSchema: {
        hint_id: z.string().describe('Hint ID of the element to scroll into view'),
        position: z.enum(['center', 'start', 'end', 'nearest']).optional().describe('Where to place the element in the viewport (default: center)'),
      },
    },
    async ({ hint_id, position = 'center' }) => {
      const instance = await getBrowserInstance();
      const confirmationError = requireConfirmedRuntimeInstance(state, instance, 'scroll_into_view');
      if (confirmationError) return confirmationError;
      const page = await getPage({ state });
      await syncState(page, state, { force: true });
      const normalizedId = String(hint_id).trim();
      const selector = `[data-grasp-id="${normalizedId}"]`;

      const result = await page.evaluate(({ sel, pos }) => {
        const el = document.querySelector(sel);
        if (!el) return { ok: false, reason: 'not_found' };

        const before = el.getBoundingClientRect();
        el.scrollIntoView({ behavior: 'instant', block: pos, inline: 'nearest' });
        const after = el.getBoundingClientRect();

        return {
          ok: true,
          tag: el.tagName.toLowerCase(),
          label: el.getAttribute('aria-label') || el.innerText?.trim()?.substring(0, 60) || '',
          moved: Math.abs(after.top - before.top) > 1 || Math.abs(after.left - before.left) > 1,
          rect: {
            top: Math.round(after.top),
            left: Math.round(after.left),
            width: Math.round(after.width),
            height: Math.round(after.height),
          },
        };
      }, { sel: selector, pos: position });

      if (!result.ok) {
        return errorResponse(`Element [${normalizedId}] not found. Call get_hint_map to refresh.`);
      }

      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await syncState(page, state, { force: true });
      await audit('scroll_into_view', `[${normalizedId}] position=${position}`, null, state);

      const movedLabel = result.moved ? 'Scrolled to' : 'Already visible:';
      return textResponse(
        `${movedLabel} [${normalizedId}] (${result.tag}: "${result.label}"). Position: top=${result.rect.top}px, left=${result.rect.left}px.`,
        { hint_id: normalizedId, position, moved: result.moved, rect: result.rect }
      );
    }
  );
}
