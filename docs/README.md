# Grasp Docs

Public docs for the Grasp Agent Web Runtime.

Current package release: `v0.5.2`

---

## Quickstart

- [Project README](../README.md)
- [中文 README](../README.zh-CN.md)

## Product Overview

- [Agent Web Runtime](./product/browser-runtime-for-agents.md)

Core runtime story:

- real browsing first
- persistent login and recovery
- isolated browser state
- basic multi-task runtime direction
- one interface with `Runtime Engine` and a thin `Data Engine` read seam

The product does not collapse into BOSS and does not collapse into scraping. BOSS is one example on top of the runtime, while the `Data Engine` wording here marks the public-web read direction without claiming a fully delivered separate backend in this slice.

## Agent Surface

Read in this order:

1. bootstrap the local runtime
2. use MCP tools as the public runtime surface
3. use the skill when you want the recommended task-facing layer

For the canonical product-layer mapping, see [Agent Web Runtime](./product/browser-runtime-for-agents.md).

- [MCP Tools](./reference/mcp-tools.md)
- [Agent Skill](../skill/SKILL.md)
- [Search benchmark notes](./benchmarks/search-benchmark.md)

## Reference

- [CHANGELOG](../CHANGELOG.md)
- [CONTRIBUTING](../CONTRIBUTING.md)

## Releases

- [v0.5.2 release notes](./release-notes-v0.5.2.md)
