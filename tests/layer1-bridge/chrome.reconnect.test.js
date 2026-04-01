import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectionSupervisor, getActivePage } from '../../src/layer1-bridge/chrome.js';

test('supervisor marks browser unreachable after bounded retries', async () => {
  let attempt = 0;
  const snapshots = [];
  const supervisor = createConnectionSupervisor({
    connect: async () => {
      attempt += 1;
      throw new Error(`ECONNREFUSED attempt ${attempt}`);
    },
    now: () => 1000,
    retryDelays: [0, 0, 0],
    persistStatus: async (snapshot) => {
      snapshots.push(snapshot);
    },
    autoLaunch: null,
  });

  await assert.rejects(() => supervisor.getBrowser());

  const status = supervisor.getStatus();
  assert.strictEqual(status.state, 'CDP_UNREACHABLE');
  assert.strictEqual(status.retryCount, 3);
  assert.strictEqual(attempt, 3);

  const lastSnapshot = snapshots[snapshots.length - 1];
  assert.strictEqual(lastSnapshot?.state, 'CDP_UNREACHABLE');
  assert.strictEqual(lastSnapshot?.retryCount, 3);
  assert.ok(typeof lastSnapshot?.lastError === 'string' && lastSnapshot.lastError.includes('ECONNREFUSED'));
  assert.ok(typeof lastSnapshot?.updatedAt === 'number');
});

test('supervisor transitions to disconnected when browser emits event', async () => {
  let disconnectHandler;
  const browser = {
    isConnected: () => true,
    once: (event, handler) => {
      if (event === 'disconnected') {
        disconnectHandler = handler;
      }
    },
  };

  const supervisor = createConnectionSupervisor({
    connect: async () => browser,
    now: () => 2000,
    retryDelays: [0],
    persistStatus: async () => {},
  });

  await supervisor.getBrowser();
  assert.ok(typeof disconnectHandler === 'function');

  disconnectHandler();

  const status = supervisor.getStatus();
  assert.strictEqual(status.state, 'disconnected');
  assert.strictEqual(status.lastError, 'browser disconnected');
});

test('supervisor retries by auto-launching a local browser after CDP failures', async () => {
  let connectAttempt = 0;
  let launched = false;
  const browser = {
    isConnected: () => true,
    once: () => undefined,
  };

  const supervisor = createConnectionSupervisor({
    connect: async () => {
      connectAttempt += 1;
      if (!launched) {
        throw new Error(`ECONNREFUSED attempt ${connectAttempt}`);
      }
      return browser;
    },
    now: () => 3000,
    retryDelays: [0, 0, 0],
    persistStatus: async () => {},
    autoLaunch: async (cdpUrl) => {
      assert.equal(cdpUrl, 'http://localhost:9222');
      launched = true;
      return true;
    },
  });

  const result = await supervisor.getBrowser();
  const status = supervisor.getStatus();

  assert.equal(result, browser);
  assert.equal(connectAttempt, 4);
  assert.equal(status.state, 'connected');
  assert.equal(status.retryCount, 4);
  assert.equal(status.lastError, null);
});

test('getActivePage creates a blank tab when the browser context has no pages', async () => {
  const blankPage = { url: () => 'about:blank' };
  let newPageCalls = 0;
  const browser = {
    contexts: () => [{
      pages: () => [],
      newPage: async () => {
        newPageCalls += 1;
        return blankPage;
      },
    }],
  };

  const page = await getActivePage({ browser });

  assert.equal(page, blankPage);
  assert.equal(newPageCalls, 1);
});
