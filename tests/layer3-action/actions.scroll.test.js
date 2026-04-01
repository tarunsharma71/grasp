import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakePage } from '../helpers/fake-page.js';
import { findScrollableAncestor, scroll } from '../../src/layer3-action/actions.js';

function runWithBrowserGlobals(run, { querySelector, getComputedStyle, querySelectorAll } = {}) {
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalCss = global.CSS;
  const originalRequestAnimationFrame = global.requestAnimationFrame;

  const wrappedQuerySelectorAll = querySelectorAll ?? ((selector) => {
    if (!querySelector) return [];
    const match = querySelector(selector);
    return match ? [match] : [];
  });
  global.document = {
    documentElement: {},
    querySelector,
    querySelectorAll: wrappedQuerySelectorAll,
  };
  global.window = {
    document: global.document,
    getComputedStyle,
  };
  global.CSS = {
    escape: (value) => String(value),
  };
  global.requestAnimationFrame = (callback) => callback();

  return Promise.resolve()
    .then(run)
    .finally(() => {
      global.document = originalDocument;
      global.window = originalWindow;
      global.CSS = originalCss;
      global.requestAnimationFrame = originalRequestAnimationFrame;
    });
}

test('findScrollableAncestor returns the nearest scrollable container selector', async () => {
  const root = {};
  const container = {
    id: 'scroll-container',
    tagName: 'DIV',
    contentEditable: 'false',
    scrollHeight: 900,
    clientHeight: 200,
    scrollWidth: 300,
    clientWidth: 300,
    classList: [],
    getAttribute: () => null,
    parentElement: root,
  };
  const target = {
    tagName: 'BUTTON',
    contentEditable: 'false',
    scrollHeight: 20,
    clientHeight: 20,
    scrollWidth: 20,
    clientWidth: 20,
    classList: [],
    getAttribute: (name) => (name === 'data-grasp-id' ? 'B3' : null),
    parentElement: container,
  };
  const page = createFakePage({
    evaluate: async (fn, ...args) => runWithBrowserGlobals(
      () => fn(...args),
      {
        querySelector: (selector) => (selector === '[data-grasp-id="B3"]' ? target : selector === '#scroll-container' ? container : null),
        getComputedStyle: (element) => {
          if (element === container) {
            return { overflowY: 'auto', overflowX: 'hidden' };
          }
          return { overflowY: 'visible', overflowX: 'visible' };
        },
      }
    ),
  });

  const selector = await findScrollableAncestor(page, '[data-grasp-id="B3"]');
  assert.equal(selector, '#scroll-container');
});

test('findScrollableAncestor skips ambiguous fallback selectors', async () => {
  const parent = {
    id: 'unique-parent',
    tagName: 'DIV',
    scrollHeight: 1000,
    clientHeight: 200,
    contentEditable: 'false',
    classList: [],
    scrollWidth: 0,
    clientWidth: 0,
    parentElement: {},
    getAttribute: () => null,
  };
  const duplicate = {
    tagName: 'DIV',
    contentEditable: 'false',
    classList: ['scrollable'],
    scrollHeight: 900,
    clientHeight: 200,
    getAttribute: () => null,
  };
  const container = {
    tagName: 'DIV',
    contentEditable: 'false',
    scrollHeight: 900,
    clientHeight: 200,
    scrollWidth: 0,
    clientWidth: 0,
    classList: ['scrollable'],
    parentElement: parent,
    getAttribute: () => null,
  };
  const target = {
    tagName: 'BUTTON',
    contentEditable: 'false',
    scrollHeight: 20,
    clientHeight: 20,
    scrollWidth: 20,
    clientWidth: 20,
    classList: [],
    getAttribute: (name) => (name === 'data-grasp-id' ? 'B4' : null),
    parentElement: container,
  };

  const selectorMap = new Map([
    ['[data-grasp-id="B4"]', target],
    ['#unique-parent', parent],
    ['div.scrollable', [container, duplicate]],
  ]);

  const page = createFakePage({
    evaluate: async (fn, ...args) => runWithBrowserGlobals(
      () => fn(...args),
      {
        querySelector: (sel) => {
          const entry = selectorMap.get(sel);
          if (Array.isArray(entry)) return entry[0] ?? null;
          return entry ?? null;
        },
        querySelectorAll: (sel) => {
          const entry = selectorMap.get(sel);
          if (Array.isArray(entry)) return entry;
          if (entry) return [entry];
          return [];
        },
        getComputedStyle: (element) => {
          const isScrollable = element === container || element === parent;
          return {
            overflowY: isScrollable ? 'auto' : 'visible',
            overflowX: 'visible',
          };
        },
      }
    ),
  });

  const selector = await findScrollableAncestor(page, '[data-grasp-id="B4"]');
  assert.equal(selector, '#unique-parent');
});

test('scroll supports horizontal wheel scrolling on the page', async () => {
  const page = createFakePage({
    evaluate: async (fn, ...args) => runWithBrowserGlobals(() => fn(...args)),
  });

  await scroll(page, 'right', 200);

  const wheelCalls = page.actionsLog.filter((entry) => entry.target === 'mouse' && entry.method === 'wheel');
  assert.equal(wheelCalls.length, 5);
  assert.deepEqual(wheelCalls.map((entry) => entry.args), [
    [40, 0],
    [40, 0],
    [40, 0],
    [40, 0],
    [40, 0],
  ]);
});

test('scroll targets a specific container when selector is provided', async () => {
  const container = {
    tagName: 'DIV',
    scrollBy: (dx, dy) => {
      container.scrollLeft += dx;
      container.scrollTop += dy;
    },
    scrollLeft: 0,
    scrollTop: 0,
  };
  const page = createFakePage({
    evaluate: async (fn, ...args) => runWithBrowserGlobals(
      () => fn(...args),
      {
        querySelector: (selector) => (selector === '#scroll-container' ? container : null),
        getComputedStyle: () => ({ overflowY: 'visible', overflowX: 'visible' }),
      }
    ),
  });

  await scroll(page, 'left', 150, { selector: '#scroll-container' });

  const wheelCalls = page.actionsLog.filter((entry) => entry.target === 'mouse' && entry.method === 'wheel');
  assert.equal(wheelCalls.length, 0);
  assert.equal(container.scrollLeft, -150);
  assert.equal(container.scrollTop, 0);
});
