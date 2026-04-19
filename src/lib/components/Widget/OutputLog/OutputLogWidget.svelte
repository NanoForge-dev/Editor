<script lang="ts">
  import { exampleLogs } from '../../demo/logs';

  type LogLevel = 'info' | 'warning' | 'error';

  interface LogEntry {
    id: number;
    time: string;
    level: LogLevel;
    source?: string;
    message: string;
  }

  let search = '';

  let logs: LogEntry[] = exampleLogs as LogEntry[];

  $: filteredLogs = logs.filter(
    (log) =>
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.source?.toLowerCase().includes(search.toLowerCase()),
  );

  const levelStyles = {
    info: 'text-neutral-200',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
</script>

<div class="m-2 h-full w-full flex flex-col gap-2 overflow-hidden bg-neutral-800 py-2 text-md">
  <div class="flex">
    <input
      bind:value={search}
      placeholder="Search Log"
      class="w-full border border-neutral-700 rounded-md bg-neutral-900 px-2 py-1 placeholder-neutral-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </div>

  <div class="h-full w-full overflow-y-auto rounded-md bg-black px-2 py-1 font-mono text-sm">
    {#each filteredLogs as log (log.id)}
      <div class={`flex gap-2 py-0.5 ${levelStyles[log.level]}`}>
        <span class="shrink-0 text-neutral-500">
          [{log.time}]
        </span>

        {#if log.source}
          <span class="shrink-0 text-blue-400">
            [{log.source}]
          </span>
        {/if}

        <span class="whitespace-pre-wrap break-words">
          {log.message}
        </span>
      </div>
    {/each}

    {#if filteredLogs.length === 0}
      <div class="py-2 italic text-neutral-600">No logs matching your search</div>
    {/if}
  </div>
</div>
