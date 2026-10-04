# Inspectors plugin (`@nanoforge/inspectors`)

Requirements session: 2026-10-01. Built-in plugin in `plugins/inspectors`, the third of phase 11.

One plugin, three widgets in the bottom dock, after Console and Problems (Console stays the tab shown first): **Profiler**, **Network** and **World**. Each can be moved or closed on its own. The plugin loads when one of them is first shown. They show the running game: with nothing playing, each says so and keeps what the last run recorded.

Every widget has a **Client / Server** selector when both run.

The plugin asks the engine for data only while it is needed: a widget asks for its feature while it is shown, and stops when it is hidden or closed. What was recorded stays until the next run starts.

## Profiler

- **Tick time chart**: the average and the maximum tick duration of each sampling window (250 ms), over the last two minutes.
- **Budget line**: a horizontal line at `@nanoforge/inspectors.tickBudgetMs` (default 16.7 ms). Windows whose maximum went over it are marked as **spikes**, and the header counts them.
- **Ticks per second**: the current value, and a small chart under the tick chart.
- **Pause**: freezes the charts (the game keeps running and samples keep being recorded). Resume jumps back to live.
- **Inspect a window**: hovering the chart shows that window's numbers; clicking pins it (pausing the view). The tables below then show that window instead of the latest one.
- **Libraries table**: per engine library, average and maximum time per tick in the window, and its share of the tick.
- **Systems table**: per ECS system, in run order: average and maximum time per call, and calls in the window. Needs the ECS library with system timings (see _Other repositories_); without it the table says the engine doesn't report them.

## Network

- **Packet list**: time, direction (in/out), transport (TCP/UDP), client (server side), size, and the start of the payload. Newest at the bottom; the view follows unless you scrolled up. The last 2000 packets are kept.
- **Filters**: direction, transport, and a text search over the decoded payload and the hex bytes.
- **Packet detail**: selecting a packet shows
  - **Decoded**: the payload as formatted JSON when it parses, else as text when it is valid UTF-8, else nothing;
  - **Bytes**: a hex dump with offsets and printable characters.
  - The editor asks for the first 512 bytes of each packet; the detail says when a packet was longer.
- **Throughput charts**: bytes per second and packets per second, in and out, over the last two minutes. They come from totals the network library counts for every packet, so they stay right when packets are left out of the list.
- The engine lists at most 200 packets per second. Over that, the header says how many packets the list is missing.

## World

- A **read-only tree** of the running ECS world: entities, their components, the fields of each component (nested values expand).
- **Search query**, one or more terms separated by spaces, all of which must match an entity:
  - `Position`: has a component whose name contains the text;
  - `Position.x`: has that field;
  - `Position.x > 100`, `Position.x = 0` (`=`, `!=`, `>`, `>=`, `<`, `<=`): compares the field's value (numbers as numbers, anything else as text);
  - `x > 100`, `x`: the same without a component name: a field of any component;
  - `#12`: the entity with that id.
  - `"some text"` in quotes: plain text, searched in component names, field names and values.
  - Entities are named by their id (`#12`): the running world has no variable names.
- The header counts the entities shown and in the world.
- It updates while the game runs (every 250 ms when something changed), and while paused.
- To edit the running world, use the ECS plugin's live mode: this panel never changes anything.

## Core additions

- **Protocol**: `EngineFeatures.ecsSystemStats` and `networkTrace.maxBytes`; `mergeFeatures` merges them (the shortest interval, the largest size).
- **SDK**: types of the engine events the inspectors read (`EngineFrameStats`, `EngineNetworkTrace`, `EngineNetworkStats`, `EngineSystemStats`, `EngineWorld`).

## Other repositories (unpushed worktree)

Engine (`../engine-editor-bridge`):

- **ECS library**: the `ecsSystemStats: { intervalMs }` feature. The library times each system call and sends `ecs-system-stats` (per system: name, average and maximum time per call, calls) every interval.
- **Network library**:
  - `networkTrace.maxBytes`: trace events then carry `data`, the payload's first `maxBytes` bytes in hex (2048 at most), next to the 16 bytes of `head`;
  - `network-stats` events every second while traces are asked for: packets and bytes, in and out, per transport, counted for every packet, and how many packets were left out of the traces.

An older engine ignores these: the Systems table, the packet detail and the throughput charts then say what is missing.

## Not built

- Per-system timings on engines without the ECS library change above.
- Recording a run and exporting it, pausing or clearing the packet list, sampling controls (not asked for).
- A flame chart or per-frame capture: the engine reports windows, not single ticks.

## Done when

- Unit tests: sample history (ring, spikes), packet decoding and hex dump, throughput buckets, the world query (terms, comparisons, plain text), feature merging.
- Engine tests: system timings, trace payload bytes.
- Browser tests (with the engine):
  - the Profiler draws tick windows while playing, lists libraries and systems, and pinning a window pauses the view;
  - the Network panel lists packets, filters them, shows a decoded payload and its bytes;
  - the World panel lists the entities, and a query narrows them.
- Without a game running, each panel shows its empty state.
