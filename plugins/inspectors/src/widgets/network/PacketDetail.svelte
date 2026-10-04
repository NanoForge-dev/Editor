<script lang="ts">
  import { type decodePayload, formatBytes, type hexDump } from '../../network/packets';
  import type { Packet } from '../../recorder/recorder';

  interface Props {
    packet: Packet | undefined;
    /** The packet's payload as the editor has it, decoded and dumped. */
    detail:
      | {
          bytes: Uint8Array;
          decoded: ReturnType<typeof decodePayload>;
          rows: ReturnType<typeof hexDump>;
          missing: number;
        }
      | undefined;
  }

  const { packet, detail }: Props = $props();
</script>

<aside class="detail" aria-label="Packet detail">
  {#if packet && detail}
    <h3>
      {packet.direction === 'in' ? 'Received' : 'Sent'} over {packet.transport.toUpperCase()},
      {formatBytes(packet.size)}
    </h3>
    {#if detail.missing > 0}
      <p class="note">
        The first {detail.bytes.length} bytes: {detail.missing} more were not sent to the editor.
      </p>
    {/if}
    {#if detail.decoded.kind !== 'binary'}
      <h4>Decoded ({detail.decoded.kind === 'json' ? 'JSON' : 'text'})</h4>
      <pre aria-label="Decoded payload">{detail.decoded.text}</pre>
    {/if}
    <h4>Bytes</h4>
    <div class="dump" role="group" aria-label="Payload bytes">
      {#each detail.rows as row (row.offset)}
        <div>
          <span class="offset">{row.offset}</span>
          <span>{row.hex.join(' ').padEnd(47)}</span>
          <span class="ascii">{row.ascii}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="note">Select a packet to see its payload.</p>
  {/if}
</aside>

<style>
  .detail {
    min-height: 0;
    padding: var(--nf-space-2);
    overflow: auto;
    border-left: 1px solid var(--nf-color-border);
  }
  .note {
    margin: 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  h3,
  h4 {
    margin: 0 0 var(--nf-space-1);
    font-size: var(--nf-font-size-sm);
  }
  h4 {
    margin-top: var(--nf-space-2);
    color: var(--nf-color-text-muted);
    font-weight: 400;
  }
  .dump div {
    display: flex;
    gap: 2ch;
    white-space: pre;
  }
  pre,
  .dump {
    margin: 0;
    padding: var(--nf-space-2);
    border-radius: var(--nf-radius-control);
    background: var(--nf-color-sunken);
    font-family: var(--nf-font-code);
    font-size: var(--nf-font-size-sm);
    overflow: auto;
  }
  .offset,
  .ascii {
    color: var(--nf-color-text-faint);
  }
</style>
