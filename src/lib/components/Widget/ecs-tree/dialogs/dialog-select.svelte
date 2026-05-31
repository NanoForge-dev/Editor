<script lang="ts">
  import { InputDialog } from '$lib/components/dialogs';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

  interface Props {
    open?: boolean;
    title?: string;
    text?: string;
    value?: string;
    options: (string | { label: string; value: string })[];
    confirmText?: string;
    onConfirm?: (name: string) => void;
  }

  let {
    open = $bindable(false),
    title,
    text,
    value = $bindable(''),
    options,
    confirmText,
    onConfirm,
  }: Props = $props();

  const handleConfirm = () => {
    if (!value) throw 'Value is required';
    onConfirm?.(getValue(value));
  };

  const reset = () => {
    value = '';
  };

  let selectedLabel = $derived.by(() => {
    const selected = options.find((opt) => {
      return getValue(opt) === value;
    });
    if (selected) return getLabel(selected);
    return text ?? 'Pick a system';
  });

  const getLabel = (opt: string | { label: string; value: string }) => {
    if (typeof opt === 'string') return opt;
    return opt.label;
  };

  const getValue = (opt: string | { label: string; value: string }) => {
    if (typeof opt === 'string') return opt;
    return opt.value;
  };
</script>

<InputDialog {title} {confirmText} bind:open onConfirm={handleConfirm} {reset}>
  <div class="py-2">
    <Select type="single" bind:value>
      <SelectTrigger class="w-full">{selectedLabel}</SelectTrigger>
      <SelectContent>
        {#each options as opt (getValue(opt))}
          <SelectItem value={getValue(opt)}>{getLabel(opt)}</SelectItem>
        {/each}
      </SelectContent>
    </Select>
  </div>
</InputDialog>
