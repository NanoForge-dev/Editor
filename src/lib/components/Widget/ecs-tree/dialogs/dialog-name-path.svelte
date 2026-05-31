<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { InputDialog } from '$lib/components/dialogs';

  interface Props {
    open?: boolean;
    title?: string;
    nameText?: string;
    pathText?: string;
    confirmText?: string;
    onConfirm?: (name: string, path: string) => void;
  }

  let {
    open = $bindable(false),
    title,
    nameText,
    pathText,
    confirmText,
    onConfirm,
  }: Props = $props();

  let name = $state('');
  let path = $state('');

  const handleConfirm = () => {
    const n = name.trim();
    if (!n) throw 'Name is required';
    onConfirm?.(n, path.trim() || `./${n}.ts`);
  };

  const reset = () => {
    name = '';
    path = '';
  };
</script>

<InputDialog {title} {confirmText} bind:open onConfirm={handleConfirm} {reset}>
  <div class="flex flex-col gap-3 py-2">
    <Input placeholder={nameText ?? 'Name'} bind:value={name} />
    <Input placeholder={pathText ?? 'Path (optional)'} bind:value={path} />
  </div>
</InputDialog>
