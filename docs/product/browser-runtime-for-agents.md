# Agent Web Runtime

Grasp is an Agent Web Runtime. It gives agents one interface for real browser work and public-web extraction without collapsing the product into a single site, a single workflow, or a scraping-only story.

## What the product provides

- real-page entry instead of search-substitute browsing
- an isolated `chrome-grasp` profile
- persistent browser sessions the agent can come back to
- basic multi-task runtime state
- verified browser actions
- evidence-backed handoff and resume
- one interface with `Runtime Engine` and a thin `Data Engine` read seam

## One interface, two backends

The product surface stays coherent for the agent, but the read path is currently still through the browser path and shared projection contract. In this slice, `Data Engine` is a thin read seam and selection direction, not a fully delivered separate backend:

- `Runtime Engine`: authenticated browser work, live sessions, navigation, handoff, and recovery
- `Data Engine`: public-web discovery and extraction when live browser control is not the right tool

This is the current product direction: one interface, with `Runtime Engine` first-class and `Data Engine` indicating the intended read split without overstating delivery. The product is not a scraper with browser wording layered on top, and it is not a browser-only story that ignores public-web reads.

## Delivery surfaces, not product identity

- Bootstrap: `npx grasp` or `grasp connect`
- Public runtime surface: MCP tools such as `entry`, `inspect`, `extract`, `continue`
- Recommended task layer: [Grasp skill](../../skill/SKILL.md)

`npx grasp` / `grasp connect` only bootstrap the local runtime. MCP tools are the public runtime surface. The skill is the recommended task-facing layer on top of the same interface. CLI, MCP, and the skill are delivery surfaces for the Agent Web Runtime, not separate product identities.

Bootstrap also establishes the local Chrome/CDP connection Grasp needs. That is a bootstrap concern, not a separate product layer users normally manage by hand.

## Why this shape matters

Real web tasks are continuous. The runtime has to survive:

- real-page browsing without falling back to search-first shortcuts
- login state
- checkpoint pages
- one-time human intervention
- resumed work in the same browser session
- more than one task/session context over time

At the same time, not every read needs a live browser session. The Data Engine covers public-web discovery and extraction without turning the whole product into scraping.

## BOSS is an example, not the boundary

BOSS is one example on top of the Agent Web Runtime. It proves the runtime on a concrete workflow, but it does not define the boundary. The same product story also covers flows such as WeChat Official Accounts and Xiaohongshu when they need persistent login, isolated browser state, and recovery.

## What Grasp is saying

- it is an Agent Web Runtime
- it emphasizes real browsing, persistent sessions, isolation, and recovery
- it exposes one interface with `Runtime Engine` and a thin `Data Engine` read seam
- it reaches users through CLI bootstrap, MCP, and a skill surface

## What Grasp is not saying

- it is not just a browser gateway
- it is not just `npx grasp`
- it is not limited to BOSS
- it is not a scraping-only product

For the exact tool surface, see [MCP Tools](../reference/mcp-tools.md).
