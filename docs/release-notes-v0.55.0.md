# Grasp v0.55.0 Release Notes

日期：2026-03-26  
版本：`v0.55.0`

---

## Summary

`v0.55.0` is the release that closes the last workspace consistency gaps for navigation-first authenticated surfaces.

This release focuses on four things:
- recognizing current navigation state more reliably
- treating repeated selection of the current navigation item as success
- keeping workspace snapshot structure aligned with the visible selected item
- aligning summary wording with the actual selected workspace state

In short:

> Grasp v0.55.0 is about making workspace state read true, not just look true.

---

## What is new in v0.55.0

### 1. Current navigation state is recognized more reliably
Grasp now treats common navigation-state signals as real selection evidence, including:
- `aria-current`
- `aria-selected`
- common class tokens such as `*_current` and `*_selected`

This matters on real authenticated admin surfaces where the current item is visible, but the page does not expose that state through cleaner ARIA semantics.

### 2. Re-selecting the current navigation item is now a valid no-op
If a navigation-style workspace list already shows the requested item as selected, `select_live_item` now returns success instead of failing with a virtualized-window style error.

This removes a false failure mode on left-rail navigation surfaces such as WeChat Official Accounts.

### 3. Workspace snapshots now stay structurally consistent
When hint-derived navigation items are merged back into the workspace snapshot, Grasp now reconciles:
- `active_item`
- `active_item_label`
- `selection_window`
- related verification and evidence fields

This means the public workspace shape, tool evidence, and summary text now describe the same state instead of drifting apart.

### 4. Workspace summary wording now matches the selected item
`workspace_inspect` and related workspace tools now prefer the visible selected item label on list surfaces.

So instead of returning:
- `Workspace list • no active item`

the runtime can now correctly return:
- `Workspace list • 首页`

when the page visibly shows `首页` as the current item.

### 5. Versioned docs and package metadata now match the release
The package version, lockfile version, README badges, docs index, changelog, and release links are now aligned to `v0.55.0`.

---

## Real validation in v0.55.0

### WeChat Official Accounts workspace smoke
On a real authenticated WeChat Official Accounts workspace:
1. `continue` suggests `workspace_inspect`
2. `workspace_inspect` reports `Workspace list • 首页`
3. repeated `select_live_item('首页')` returns `selected`

This validates that current navigation state is now recognized as real selection state instead of being treated as an unresolved transition.

### Automated test status
Current automated test status:

> `209 / 209` passing

---

## What v0.55.0 improves

Grasp v0.55.0 improves:
- navigation-state recognition on authenticated workspace surfaces
- repeat-selection behavior for current navigation items
- consistency between snapshot structure, evidence, and public summary wording
- release metadata consistency across package files and docs

---

## What v0.55.0 does not change

Grasp v0.55.0 does **not** change:
- the public workspace tool sequence
- the preview-first / confirmation-first safety model
- the broader product boundary around the Agent Web Runtime

This is a consistency and correctness release, not a surface-expansion release.

---

## Recommended reading

For the current runtime surface:
- `README.md`
- `README.zh-CN.md`
- `docs/README.md`

For the workspace tool flow:
- `docs/reference/mcp-tools.md`
- `docs/reference/smoke-paths.md`
