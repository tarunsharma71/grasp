import { createFakePage } from './fake-page.js';

export function createTaskFixture(options = {}) {
  const { page, metadata, taskId, ...rest } = options;
  return {
    taskId: taskId ?? `fake-task-${Date.now()}`,
    page: page ?? createFakePage(),
    metadata: metadata ?? {},
    ...rest,
  };
}
