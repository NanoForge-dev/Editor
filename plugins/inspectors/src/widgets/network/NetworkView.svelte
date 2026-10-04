<script lang="ts">
  import { tick, untrack } from 'svelte';

  import { EmptyState, Input, type WidgetInstance } from '@nanoforge-dev/editor-sdk/ui';

  import SourcePicker from '../SourcePicker.svelte';
  import { follow } from '../follow.svelte';
  import { decodePayload, formatBytes, hexDump, hexToBytes } from '../../network/packets';
  import type { Packet } from '../../recorder/recorder';
  import { getRecorder } from '../../session/recorder-session';
  import PacketDetail from './PacketDetail.svelte';
  import ThroughputCharts from './ThroughputCharts.svelte';

  type Choice<T extends string> = 'all' | T;

  const { instance }: { instance: WidgetInstance } = $props();
  // svelte-ignore state_referenced_locally
  const view = follow(getRecorder(), 'network', instance.visible);

  let direction = $state<Choice<'in' | 'out'>>('all');
  let transport = $state<Choice<'tcp' | 'udp'>>('all');
  let query = $state('');
  let selectedId = $state<number>();
  let list = $state<HTMLElement>();
  let stick = $state(true);

  const record = $derived(view.record);
  const packets = $derived(record?.packets ?? []);
  const totals = $derived(record?.network ?? []);

  /** Payload bytes the editor has, and how people read them (computed once per packet). */
  const details = new WeakMap<Packet, { bytes: Uint8Array; text: string; search: string }>();
  const detailOf = (packet: Packet) => {
    let found = details.get(packet);
    if (!found) {
      const bytes = hexToBytes(packet.data ?? packet.head);
      const decoded = decodePayload(bytes, bytes.length >= packet.size);
      const text = decoded.kind === 'binary' ? '' : decoded.text;
      found = { bytes, text, search: text.toLowerCase().replace(/\s+/g, '') };
      details.set(packet, found);
    }
    return found;
  };

  const needle = $derived(query.toLowerCase().replace(/\s+/g, ''));
  const shown = $derived(
    packets.filter(
      (packet) =>
        (direction === 'all' || packet.direction === direction) &&
        (transport === 'all' || packet.transport === transport) &&
        (!needle ||
          detailOf(packet).search.includes(needle) ||
          (packet.data ?? packet.head).includes(needle) ||
          (packet.clientId ?? '').toLowerCase().includes(needle)),
    ),
  );
  const selected = $derived(packets.find((packet) => packet.id === selectedId));
  const selectedDetail = $derived.by(() => {
    if (!selected) return undefined;
    const { bytes } = detailOf(selected);
    return {
      bytes,
      decoded: decodePayload(bytes, bytes.length >= selected.size),
      rows: hexDump(bytes),
      missing: selected.size - bytes.length,
    };
  });

  $effect(() => {
    void shown;
    if (untrack(() => stick)) void tick().then(() => list && (list.scrollTop = list.scrollHeight));
  });
  const onscroll = () => {
    if (list) stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 8;
  };

  const time = (value: number) => {
    const date = new Date(value);
    return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  };
  const preview = (packet: Packet) => {
    const { text } = detailOf(packet);
    return text ? text.replace(/\s+/g, ' ').slice(0, 80) : packet.head;
  };
</script>

{#snippet choice(
  label: string,
  value: string,
  options: readonly (readonly [string, string])[],
  set: (value: string) => void,
)}
  <div class="choice" role="group" aria-label={label}>
    {#each options as [id, text] (id)}
      <button type="button" aria-pressed={value === id} onclick={() => set(id)}>{text}</button>
    {/each}
  </div>
{/snippet}

<div class="network">
  {#if !record || (!packets.length && !totals.length)}
    <EmptyState
      icon="activity"
      title="No packets yet"
      description="Play a game that uses the network library: its packets appear here."
    />
  {:else}
    <div class="toolbar">
      <SourcePicker
        sources={view.sources}
        value={view.source ?? 'client'}
        onchange={(source) => {
          view.source = source;
          selectedId = undefined;
        }}
      />
      {@render choice(
        'Direction',
        direction,
        [
          ['all', 'All'],
          ['in', 'In'],
          ['out', 'Out'],
        ],
        (value) => (direction = value as typeof direction),
      )}
      {@render choice(
        'Transport',
        transport,
        [
          ['all', 'All'],
          ['tcp', 'TCP'],
          ['udp', 'UDP'],
        ],
        (value) => (transport = value as typeof transport),
      )}
      <Input bind:value={query} placeholder="Search payloads" aria-label="Search payloads" />
      <span class="count" role="status">
        {shown.length} of {packets.length} packets{record.untraced
          ? `, ${record.untraced} more not listed`
          : ''}
      </span>
    </div>
    <ThroughputCharts {totals} />
    <div class="body">
      <div class="list" bind:this={list} {onscroll}>
        <table aria-label="Packets">
          <thead>
            <tr>
              <th>Time</th><th>Direction</th><th>Transport</th><th>Client</th><th>Size</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {#each shown as packet (packet.id)}
              <tr
                aria-selected={packet.id === selectedId}
                tabindex="0"
                onclick={() => (selectedId = packet.id)}
                onkeydown={(event) => event.key === 'Enter' && (selectedId = packet.id)}
              >
                <td>{time(packet.time)}</td>
                <td>{packet.direction === 'in' ? '← in' : '→ out'}</td>
                <td>{packet.transport.toUpperCase()}</td>
                <td>{packet.clientId ?? ''}</td>
                <td class="size">{formatBytes(packet.size)}</td>
                <td class="payload">{preview(packet)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <PacketDetail packet={selected} detail={selectedDetail} />
    </div>
  {/if}
</div>

<style>
  .network {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--nf-space-2);
    align-items: center;
    padding: var(--nf-space-1) var(--nf-space-2);
    border-bottom: 1px solid var(--nf-color-border);
  }
  .toolbar :global(input) {
    flex: 1;
    min-width: 120px;
  }
  .choice {
    display: inline-flex;
    border: 1px solid var(--nf-color-border);
    border-radius: var(--nf-radius-control);
    overflow: hidden;
  }
  .choice button {
    height: 22px;
    padding: 0 var(--nf-space-2);
    border: 0;
    background: none;
    color: var(--nf-color-text-muted);
    font: inherit;
    font-size: var(--nf-font-size-sm);
    cursor: pointer;
  }
  .choice button[aria-pressed='true'] {
    background: var(--nf-color-pressed);
    color: var(--nf-color-text);
  }
  .choice button:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
  .count {
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  .body {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 3fr) minmax(220px, 2fr);
    min-height: 120px;
    border-top: 1px solid var(--nf-color-border);
  }
  .list {
    min-height: 0;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
  }
  th {
    position: sticky;
    top: 0;
    background: var(--nf-color-bg);
    color: var(--nf-color-text-faint);
    font-family: var(--nf-font-ui, inherit);
    font-weight: 400;
  }
  th,
  td {
    padding: 1px var(--nf-space-2);
    text-align: left;
    white-space: nowrap;
  }
  .size {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .payload {
    max-width: 0;
    width: 100%;
    overflow: hidden;
    color: var(--nf-color-text-muted);
    text-overflow: ellipsis;
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: var(--nf-color-hover);
  }
  tbody tr[aria-selected='true'] {
    background: var(--nf-color-selection);
    color: var(--nf-color-selection-text);
  }
  tbody tr:focus-visible {
    outline: 1px solid var(--nf-color-focus);
    outline-offset: -1px;
  }
</style>
