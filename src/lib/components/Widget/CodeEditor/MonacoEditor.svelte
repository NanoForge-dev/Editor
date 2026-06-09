<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TabInstance } from '$lib/components/Tabs/types';
  import { useProject } from '$lib/client/project';
  import { loadMonacoProject, pathToUri } from '$lib/components/Widget/CodeEditor/project-loader';

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

    monaco.typescript.typescriptDefaults.setCompilerOptions({
      module: monaco.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
      baseUrl: 'file:///',
      paths: {
        '*': ['*'],
      },
      allowNonTsExtensions: true,
      noEmit: true,
      target: monaco.typescript.ScriptTarget.ESNext,
      allowImportingTsExtensions: true,
    });

    monaco.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    const rootDir = await fs.getDirectory();
    await loadMonacoProject(monaco, rootDir);

    const uri = pathToUri(tab.metadata.path);

    let model = monaco.editor.getModel(uri);
    if (!model) {
      const content = (await file.read()) ?? '';
      model = monaco.editor.createModel(content, 'typescript', uri);
    }

    editor = monaco.editor.create(container, {
      model,
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
