<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as monaco from 'monaco-editor';
  import { codeExample } from '../../demo/code-example';

  let value = codeExample;

  let container: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor;

  onMount(() => {
    editor = monaco.editor.create(container, {
      value,
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

    editor.onDidChangeModelContent(() => {
      value = editor.getValue();
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
