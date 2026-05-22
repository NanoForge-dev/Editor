<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import 'uno.css';

  import { browser } from '$app/environment';

  import '../app.css';
  import { Toaster } from '$lib/components/ui/sonner';

  let { children } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: browser,
      },
    },
  });
</script>

<Toaster />

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
