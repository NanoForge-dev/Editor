<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { GitStatus } from '@nanoforge-dev/editor-sdk';
  import { EmptyState } from '@nanoforge-dev/editor-sdk/ui';

  import { getSession } from '../session/git-session';

  interface Props {
    /** What to do when the project is not a repository. */
    description: string;
    actions?: Snippet;
    /** The panel, once the project is a repository. */
    children: Snippet<[GitStatus]>;
  }

  const { description, actions, children }: Props = $props();
  const git = getSession().store.state;
</script>

{#if $git.unavailable}
  <EmptyState icon="git-branch" title="Git is not available here" description={$git.unavailable} />
{:else if !$git.status}
  <EmptyState icon="git-branch" title="Reading the repository…" />
{:else if !$git.status.repository}
  <EmptyState
    icon="git-branch"
    title="This project is not a git repository"
    {description}
    {actions}
  />
{:else}
  {@render children($git.status)}
{/if}
