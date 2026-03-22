# MCP Tools

Grasp exposes two layers:

- gateway tools for the default product workflow
- advanced runtime primitives for tighter manual control

---

## Gateway Tools

| Tool | What it is for |
|:---|:---|
| `entry` | Enter a target URL with session-aware strategy metadata. It can indicate direct entry, warmup, or a gated path. |
| `inspect` | Inspect the current page as a gateway state: readable, gated, handoff-related, and ready or not ready for the next step. |
| `extract` | Extract the current page into a usable content payload, with optional Markdown output. |
| `continue` | Decide the next continuation step without triggering a browser action. |

Recommended default flow:

1. `entry`
2. `inspect`
3. `extract` or `continue`
4. if needed, move into handoff and then `resume_after_handoff`

Manual smoke playbook: [docs/reference/smoke-paths.md](./smoke-paths.md)

---

## Advanced Runtime Primitives

### Navigation and state

| Tool | What it is for |
|:---|:---|
| `navigate` | Direct navigation without the gateway wrapper. |
| `get_status` | Raw runtime status, page grasp, and handoff state. |
| `get_page_summary` | Quick page summary outside the gateway flow. |

### Interaction and observation

| Tool | What it is for |
|:---|:---|
| `get_hint_map` | Return the current interaction map for the visible page. |
| `click` | Click by hint ID and verify the result. |
| `type` | Type by hint ID and verify the result. |
| `hover` | Hover by hint ID and refresh page state. |
| `press_key` | Send keyboard input and refresh page state. |
| `scroll` | Scroll the current page and refresh page state. |
| `watch_element` | Watch a selector for appear, disappear, or change events. |

### Session strategy and handoff

| Tool | What it is for |
|:---|:---|
| `preheat_session` | Warm up a host before direct entry. |
| `navigate_with_strategy` | Use session-trust strategy without the gateway wrapper. |
| `session_trust_preflight` | Inspect trust level and recommended entry strategy. |
| `suggest_handoff` | Build a handoff suggestion from the current checkpoint page. |
| `request_handoff_from_checkpoint` | Persist a handoff directly from checkpoint state. |
| `request_handoff` | Mark that a human step is required. |
| `mark_handoff_in_progress` | Mark that the human step is underway. |
| `mark_handoff_done` | Mark that the human step is complete and ready for reacquisition. |
| `resume_after_handoff` | Reacquire page state after a human step and evaluate continuation evidence. |
| `clear_handoff` | Clear handoff state and return to idle. |
