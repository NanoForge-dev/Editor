import Activity from '@lucide/svelte/icons/activity';
import AppWindow from '@lucide/svelte/icons/app-window';
import Blocks from '@lucide/svelte/icons/blocks';
import Box from '@lucide/svelte/icons/box';
import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import Code from '@lucide/svelte/icons/code';
import Copy from '@lucide/svelte/icons/copy';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
import File from '@lucide/svelte/icons/file';
import FileCode from '@lucide/svelte/icons/file-code';
import Folder from '@lucide/svelte/icons/folder';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import FolderTree from '@lucide/svelte/icons/folder-tree';
import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
import GitBranch from '@lucide/svelte/icons/git-branch';
import Globe from '@lucide/svelte/icons/globe';
import GripVertical from '@lucide/svelte/icons/grip-vertical';
import History from '@lucide/svelte/icons/history';
import Info from '@lucide/svelte/icons/info';
import Layers from '@lucide/svelte/icons/layers';
import LayoutPanelLeft from '@lucide/svelte/icons/layout-panel-left';
import ListTree from '@lucide/svelte/icons/list-tree';
import LoaderCircle from '@lucide/svelte/icons/loader-circle';
import Lock from '@lucide/svelte/icons/lock';
import Maximize2 from '@lucide/svelte/icons/maximize-2';
import Minimize2 from '@lucide/svelte/icons/minimize-2';
import Minus from '@lucide/svelte/icons/minus';
import Network from '@lucide/svelte/icons/network';
import PanelBottom from '@lucide/svelte/icons/panel-bottom';
import PanelLeft from '@lucide/svelte/icons/panel-left';
import PanelRight from '@lucide/svelte/icons/panel-right';
import Pause from '@lucide/svelte/icons/pause';
import Pencil from '@lucide/svelte/icons/pencil';
import Play from '@lucide/svelte/icons/play';
import Plug from '@lucide/svelte/icons/plug';
import Plus from '@lucide/svelte/icons/plus';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import Search from '@lucide/svelte/icons/search';
import Server from '@lucide/svelte/icons/server';
import Settings from '@lucide/svelte/icons/settings';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import Square from '@lucide/svelte/icons/square';
import SquareTerminal from '@lucide/svelte/icons/square-terminal';
import StepForward from '@lucide/svelte/icons/step-forward';
import Trash2 from '@lucide/svelte/icons/trash-2';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import Variable from '@lucide/svelte/icons/variable';
import X from '@lucide/svelte/icons/x';
import type { Component } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

import type { Disposable } from '@nanoforge-dev/editor-kernel';

export type IconComponent = Component<any>;

const registry = new SvelteMap<string, IconComponent>(
  Object.entries({
    activity: Activity,
    'app-window': AppWindow,
    blocks: Blocks,
    box: Box,
    check: Check,
    'chevron-down': ChevronDown,
    'chevron-right': ChevronRight,
    'circle-alert': CircleAlert,
    'circle-check': CircleCheck,
    code: Code,
    copy: Copy,
    ellipsis: Ellipsis,
    'ellipsis-vertical': EllipsisVertical,
    file: File,
    'file-code': FileCode,
    folder: Folder,
    'folder-open': FolderOpen,
    'folder-tree': FolderTree,
    'gamepad-2': Gamepad2,
    'git-branch': GitBranch,
    globe: Globe,
    'grip-vertical': GripVertical,
    history: History,
    info: Info,
    layers: Layers,
    'layout-panel-left': LayoutPanelLeft,
    'list-tree': ListTree,
    'loader-circle': LoaderCircle,
    lock: Lock,
    'maximize-2': Maximize2,
    'minimize-2': Minimize2,
    minus: Minus,
    network: Network,
    'panel-bottom': PanelBottom,
    'panel-left': PanelLeft,
    'panel-right': PanelRight,
    pause: Pause,
    pencil: Pencil,
    play: Play,
    plug: Plug,
    plus: Plus,
    'rotate-ccw': RotateCcw,
    search: Search,
    server: Server,
    settings: Settings,
    'sliders-horizontal': SlidersHorizontal,
    square: Square,
    'square-terminal': SquareTerminal,
    'step-forward': StepForward,
    'trash-2': Trash2,
    'triangle-alert': TriangleAlert,
    variable: Variable,
    x: X,
  }),
);

/**
 * Registers icons by name (manifests reference icons by name). Plugins register the Lucide
 * icons they use: `registerIcons({ music: Music })` with `@lucide/svelte/icons/music`.
 */
export const registerIcons = (icons: Record<string, IconComponent>): Disposable => {
  const added = Object.entries(icons).filter(([name]) => !registry.has(name));
  for (const [name, icon] of added) registry.set(name, icon);
  return { dispose: () => added.forEach(([name]) => registry.delete(name)) };
};

export const resolveIcon = (name: string | undefined): IconComponent | undefined =>
  name ? registry.get(name) : undefined;
