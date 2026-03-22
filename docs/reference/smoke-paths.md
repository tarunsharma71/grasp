# Gateway Smoke Paths

These are manual Phase 1 smoke checks for the new gateway flow. They describe expected signals, not guarantees.

## 1. Direct Read

- URL: `https://example.com/`
- Tools to call: `entry` -> `inspect` -> `extract`

Expected:

| Tool | Expected status | Expected result | Expected continuation |
|---|---|---|---|
| `entry` | `direct` | no `result` payload | `can_continue: true`, `suggested_next_action: inspect` |
| `inspect` | `direct` | no `result` payload | `can_continue: true`, `suggested_next_action: extract` |
| `extract` | `direct` | `main_text` is non-empty | `can_continue: true`, `suggested_next_action: inspect` |

## 2. Session Establish / Trusted Entry

- URL: `https://github.com/`
- Tools to call: `entry` -> `inspect`

Expected:

| Tool | Expected status | Expected result | Expected continuation |
|---|---|---|---|
| `entry` | `warmup` on a cold profile, or `direct` when the local session already carries enough trust evidence | no `result` payload | trust-aware continuation that does not collapse into primitive-level instructions |
| `inspect` | `direct` once the page is readable | no `result` payload | non-empty continuation block; follow-up navigation should remain reusable in the same browser session when the local profile is already logged in |

## 3. Handoff / Resume

- URL: `https://github.com/login`
- Tools to call: `entry` -> `continue` -> `request_handoff` -> `mark_handoff_done` -> `resume_after_handoff`

Expected:

| Tool | Expected status | Expected result | Expected continuation |
|---|---|---|---|
| `entry` | `gated` or `handoff_required` | no `result` payload | `can_continue: false`, `suggested_next_action: request_handoff` |
| `continue` | `gated` or `handoff_required` | no `result` payload | `can_continue: false`, `suggested_next_action: request_handoff` |
| `request_handoff` | `handoff_required` | no `result` payload | records the human step that needs to happen next |
| `mark_handoff_done` | `awaiting_reacquisition` | no `result` payload | indicates the handoff is complete and ready to resume |
| `resume_after_handoff` | `resumed_verified` or `resumed_unverified` | continuation evidence is returned | clear next action instead of blind success |
