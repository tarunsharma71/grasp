import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraspServer } from '../src/server/index.js';
import { createFakePage } from './helpers/fake-page.js';

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

test('live web simulation: switch task and navigate records isolated history', async () => {
  const { state } = createGraspServer();
  state.runtimeConfirmation = { ...confirmedRuntime };
  
  // 1. Mock dependencies for the action tools
  const page = createFakePage({ url: 'https://initial.com' });
  
  // In McpServer, handlers are stored internally. To test realistically, 
  // we'll use the same pattern as in integrated-task-isolation.test.js 
  // but using the real registration logic.
  
  const { registerActionTools } = await import('../src/server/tools.actions.js');
  const { registerTaskTools } = await import('../src/server/tools.task-surface.js');
  
  const calls = [];
  const mockServer = { 
    registerTool(name, spec, handler) { 
      calls.push({ name, handler }); 
    } 
  };

  registerActionTools(mockServer, state, {
    getActivePage: async () => page,
    getBrowserInstance: async () => null,
    navigateTo: async (url) => {
      page.url = () => url;
      return page;
    },
    syncPageState: async () => {},
    getBrowserInstance: async () => confirmedInstance,
  });
  registerTaskTools(mockServer, state);

  const navigateTool = calls.find(t => t.name === 'navigate');
  const switchTool = calls.find(t => t.name === 'switch_task');
  const listTool = calls.find(t => t.name === 'list_tasks');

  // 1. Start a web test task
  await switchTool.handler({ taskId: 'web-test-1', kind: 'read' });
  
  // 2. Open example.com
  await navigateTool.handler({ url: 'https://example.com' });

  // 3. Verify history in task frame
  const frame = state.taskFrames.get('web-test-1');
  assert.equal(frame.history.length, 1);
  assert.equal(frame.history[0].action, 'navigate');
  assert.equal(frame.history[0].detail, 'https://example.com');

  // 4. Verify list_tasks reports the history
  const listResult = await listTool.handler();
  assert.match(listResult.content[0].text, /web-test-1/);
  
  console.log('--- Live Web Simulation Result ---');
  console.log(listResult.content[0].text);
});
