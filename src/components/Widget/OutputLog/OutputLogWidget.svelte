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

  const levelStyles: Record<LogLevel, string> = {
    info: 'text-neutral-200',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
</script>

<div class="bg-neutral-800 h-full w-full text-md py-2 overflow-hidden m-2 flex flex-col gap-2">
  <div class="flex">
    <input
      bind:value={search}
      placeholder="Search Log"
      class="w-full rounded-md bg-neutral-900 px-2 py-1 text-sm border border-neutral-700 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </div>

  <div class="bg-black w-full h-full rounded-md overflow-y-auto px-2 py-1 font-mono text-sm">
    {#each filteredLogs as log (log.id)}
      <div class={`flex gap-2 py-0.5 ${levelStyles[log.level]}`}>
        <span class="text-neutral-500 shrink-0">
          [{log.time}]
        </span>

        {#if log.source}
          <span class="text-blue-400 shrink-0">
            [{log.source}]
          </span>
        {/if}

        <span class="whitespace-pre-wrap break-words">
          {log.message}
        </span>
      </div>
    {/each}

    {#if filteredLogs.length === 0}
      <div class="text-neutral-600 italic py-2">No logs matching your search</div>
    {/if}
  </div>
</div>
