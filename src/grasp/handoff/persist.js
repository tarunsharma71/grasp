import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { createHandoffState, mergeHandoffState } from './state.js';

export const HANDOFF_STATE_PATH =
  process.env.GRASP_HANDOFF_STATE_PATH ??
  join(homedir(), '.grasp', 'handoff-state.json');

export function attachHandoffTaskMetadata(handoff = {}, source = {}) {
  return {
    ...handoff,
    taskId: source.taskId ?? handoff.taskId ?? null,
    siteKey: source.siteKey ?? handoff.siteKey ?? null,
    sessionKey: source.sessionKey ?? handoff.sessionKey ?? null,
    lastUrl: source.lastUrl ?? handoff.lastUrl ?? null,
  };
}

async function ensureDir() {
  await mkdir(dirname(HANDOFF_STATE_PATH), { recursive: true });
}

export async function writeHandoffState(snapshot) {
  try {
    await ensureDir();
    const state = attachHandoffTaskMetadata(
      mergeHandoffState(createHandoffState(), snapshot),
      snapshot
    );
    await writeFile(HANDOFF_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch {
    // best effort
  }
}

export async function readHandoffState() {
  try {
    const raw = await readFile(HANDOFF_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return attachHandoffTaskMetadata(
      mergeHandoffState(createHandoffState(), parsed),
      parsed
    );
  } catch {
    return createHandoffState();
  }
}
