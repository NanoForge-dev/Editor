import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

import ColorPicker from '../src/components/color-picker.svelte';
import Dialog from '../src/components/dialog.svelte';
import NumberInput from '../src/components/number-input.svelte';
import Select from '../src/components/select.svelte';
import Splitter from '../src/components/splitter.svelte';
import Switch from '../src/components/switch.svelte';
import Tabs from '../src/components/tabs.svelte';
import type { TreeNode } from '../src/components/tree-model';
import MenuHarness from './fixtures/MenuHarness.svelte';
import TreeHarness from './fixtures/TreeHarness.svelte';

describe('NumberInput', () => {
  it('commits typed values, arrows and scrubbing', async () => {
    const onchange = vi.fn();
    const screen = render(NumberInput, { value: 10, onchange, label: 'X', prefix: 'X', step: 1 });
    const input = screen.getByRole('textbox', { name: 'X' });
    await input.fill('12,5');
    await userEvent.keyboard('{Enter}');
    expect(onchange).toHaveBeenLastCalledWith(12.5, true);
    await input.click();
    await userEvent.keyboard('{ArrowUp}');
    expect(onchange).toHaveBeenLastCalledWith(11, true);

    const handle = screen.container.querySelector<HTMLElement>('.prefix')!;
    const rect = handle.getBoundingClientRect();
    const pointer = (type: string, x: number) =>
      handle.dispatchEvent(
        new PointerEvent(type, {
          clientX: x,
          clientY: rect.top + 2,
          button: 0,
          pointerId: 1,
          bubbles: true,
        }),
      );
    pointer('pointerdown', rect.left);
    pointer('pointermove', rect.left + 10);
    pointer('pointermove', rect.left + 50);
    pointer('pointerup', rect.left + 50);
    expect(onchange).toHaveBeenCalledWith(20, false);
    expect(onchange).toHaveBeenLastCalledWith(20, true);
  });
});

const bigTree = (): TreeNode[] =>
  Array.from({ length: 50 }, (_, i) => ({
    id: `group-${i}`,
    label: `Group ${i}`,
    children: Array.from({ length: 100 }, (_, j) => ({
      id: `n-${i}-${j}`,
      label: `Entity ${i}.${j}`,
    })),
  }));

describe('Tree', () => {
  it('only renders visible rows of large trees', async () => {
    const screen = render(TreeHarness, { nodes: bigTree() });
    (screen.getByRole('tree').element() as HTMLElement).focus(); // focuses the first row
    await userEvent.keyboard('{ArrowRight}'); // expand it
    await expect.element(screen.getByTestId('expanded')).toHaveTextContent('group-0');
    const rows = screen.container.querySelectorAll('[role="treeitem"]');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(40);
  });

  it('navigates, selects ranges and renames with the keyboard', async () => {
    const onrename = vi.fn();
    const onactivate = vi.fn();
    const nodes: TreeNode[] = [
      { id: 'a', label: 'Player', children: [{ id: 'a1', label: 'Sprite' }] },
      { id: 'b', label: 'Ball' },
      { id: 'c', label: 'Wall' },
    ];
    const screen = render(TreeHarness, { nodes, onrename, onactivate });
    await screen.getByText('Ball').click();
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await expect.element(screen.getByTestId('selected')).toHaveTextContent('b,c');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowRight}{ArrowDown}');
    await expect.element(screen.getByTestId('selected')).toHaveTextContent('a1');
    await userEvent.keyboard('{Enter}');
    expect(onactivate).toHaveBeenCalledWith('a1');
    await userEvent.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'New name' });
    await input.fill('Hero sprite');
    await userEvent.keyboard('{Enter}');
    expect(onrename).toHaveBeenCalledWith('a1', 'Hero sprite');
  });
});

describe('controls', () => {
  it('Switch toggles', async () => {
    const onchange = vi.fn();
    const screen = render(Switch, { label: 'Snap', onchange });
    await screen.getByRole('switch', { name: 'Snap' }).click();
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it('Tabs move with arrow keys', async () => {
    const onchange = vi.fn();
    const screen = render(Tabs, {
      label: 'Mode',
      active: 'game',
      onchange,
      items: [
        { id: 'game', label: 'Game' },
        { id: 'scene', label: 'Scene' },
      ],
    });
    await screen.getByRole('tab', { name: 'Game' }).click();
    await userEvent.keyboard('{ArrowRight}');
    expect(onchange).toHaveBeenLastCalledWith('scene');
  });

  it('Splitter resizes with the keyboard', async () => {
    const onresize = vi.fn();
    const screen = render(Splitter, {
      orientation: 'vertical',
      label: 'Resize left panel',
      onresize,
    });
    (screen.getByRole('separator').element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}{Shift>}{ArrowLeft}{/Shift}');
    expect(onresize.mock.calls.filter(([, final]) => final).map(([delta]) => delta)).toEqual(
      expect.arrayContaining([10, -40]),
    );
  });

  it('ColorPicker normalizes hex input', async () => {
    const onchange = vi.fn();
    const screen = render(ColorPicker, { value: '#000000', label: 'Tint', onchange });
    await screen.getByRole('textbox', { name: 'Tint', exact: true }).fill('#F80');
    await userEvent.keyboard('{Enter}');
    expect(onchange).toHaveBeenLastCalledWith('#ff8800', true);
  });

  it('Select picks an option', async () => {
    const onchange = vi.fn();
    const screen = render(Select, {
      label: 'Shape',
      value: 'circle',
      onchange,
      items: [
        { value: 'circle', label: 'Circle' },
        { value: 'rect', label: 'Rectangle' },
      ],
    });
    await screen.getByLabelText('Shape').click();
    await page.getByRole('option', { name: 'Rectangle' }).click();
    expect(onchange).toHaveBeenCalledWith('rect');
  });
});

describe('overlays', () => {
  it('Menu runs the selected item', async () => {
    const onSelect = vi.fn();
    const screen = render(MenuHarness, {
      items: [
        { kind: 'item', id: 'save', label: 'Save', shortcut: 'Ctrl+S', onSelect },
        { kind: 'separator' },
        { kind: 'item', id: 'quit', label: 'Quit', disabled: true, onSelect: vi.fn() },
      ],
    });
    await screen.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: /Save/ }).click();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('Dialog closes with Escape', async () => {
    const onclose = vi.fn();
    render(Dialog, { open: true, title: 'New scene', description: 'Name the scene.', onclose });
    await expect.element(page.getByRole('dialog', { name: 'New scene' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    expect(onclose).toHaveBeenCalledOnce();
  });
});
