<script lang="ts">
  import { Route, Router } from 'svelte-routing';
  import { routes } from './routes';
</script>

<!-- svelte-ignore css_unused_selector -->
<main>
  <Router>
    {#each Object.keys(routes) as route (route)}
      <Route path={route}>
        <svelte:component this={routes[route]} />
      </Route>
    {/each}
  </Router>
</main>
