<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TabInstance } from '$lib/components/Tabs/types';

  interface Props {
    tab: TabInstance;
  }
  let { tab = $bindable() }: Props = $props();

  let container: HTMLDivElement;
  let editor: any;

  onMount(async () => {
    const monaco = await import('monaco-editor');

    editor = monaco.editor.create(container, {
      value: (await tab.file?.read()) || '',
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
      if (tab.file) {
        tab.file.write(editor.getValue());
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
