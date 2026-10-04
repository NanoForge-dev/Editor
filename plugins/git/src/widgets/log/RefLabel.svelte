<script lang="ts">
  import type { GitStatus } from '@nanoforge-dev/editor-sdk';

  import { getSession } from '../../session/git-session';
  import { refKind } from './commit-format';

  const { ref, status }: { ref: string; status: GitStatus } = $props();
  const git = getSession().store.state;
</script>

<span class="ref" data-kind={refKind(ref, status, $git.branches)}>{ref.replace(/^tag: /, '')}</span>

<style>
  .ref {
    flex: none;
    padding: 0 5px;
    border: 1px solid currentColor;
    border-radius: 3px;
    font-size: var(--nf-font-size-xs, 11px);
  }
  .ref[data-kind='head'] {
    color: var(--ref-head);
  }
  .ref[data-kind='local'] {
    color: var(--ref-local);
  }
  .ref[data-kind='remote'] {
    color: var(--ref-remote);
  }
  .ref[data-kind='tag'] {
    color: var(--ref-tag);
  }
</style>
