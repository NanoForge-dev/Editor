<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TabInstance } from '$lib/components/Tabs/types';
  import { useProject } from '$lib/client/project';

  interface Props {
    tab: TabInstance;
  }
  let { tab = $bindable() }: Props = $props();

  const { fs } = useProject();

  let container: HTMLDivElement;
  let editor: any;

  onMount(async () => {
    const monaco = await import('monaco-editor');

    if (!tab.metadata?.path) throw new Error('Tab metadata is missing path');

    const file = await fs.getFile(tab.metadata.path);

    editor = monaco.editor.create(container, {
      value: (await file.read()) || '',
      language: 'typescript',
      theme: 'vs-dark',
      readOnly: false,
      minimap: { enabled: false },
      lineNumbers: 'on',
      glyphMargin: false,
      folding: false,
      overviewRulerLanes: 0,
      scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
      },
      renderLineHighlight: 'none',
      contextmenu: true,
      automaticLayout: true,
      tabSize: 2,
      fontSize: 14,
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (file) {
        file.write(editor.getValue());
      }
    });
  });

  onDestroy(() => {
    editor?.dispose();
  });
</script>

<div class="editor" bind:this={container}></div>

<style>
  .editor {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
  }
</style>
