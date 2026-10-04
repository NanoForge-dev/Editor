import Box from '@lucide/svelte/icons/box';
import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
import Download from '@lucide/svelte/icons/download';
import Eye from '@lucide/svelte/icons/eye';
import EyeOff from '@lucide/svelte/icons/eye-off';
import FileJson from '@lucide/svelte/icons/file-braces';
import FileImage from '@lucide/svelte/icons/file-image';
import FileMusic from '@lucide/svelte/icons/file-music';
import FileText from '@lucide/svelte/icons/file-text';
import FileType from '@lucide/svelte/icons/file-type';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import Music from '@lucide/svelte/icons/music';
import Scissors from '@lucide/svelte/icons/scissors';
import Upload from '@lucide/svelte/icons/upload';

import type { FileIcon } from '@nanoforge-dev/editor-sdk/ui';

/** Icons the file manager uses beyond the editor's own set. */
export const ICONS = {
  box: Box,
  'clipboard-paste': ClipboardPaste,
  download: Download,
  eye: Eye,
  'eye-off': EyeOff,
  'file-image': FileImage,
  'file-json': FileJson,
  'file-music': FileMusic,
  'file-text': FileText,
  'file-type': FileType,
  'layout-grid': LayoutGrid,
  music: Music,
  scissors: Scissors,
  upload: Upload,
};

/** Default file icons (other plugins contribute more, with a higher priority). */
export const FILE_ICON_DEFAULTS: FileIcon[] = [
  { pattern: '**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,svelte,vue}', icon: 'file-code' },
  { pattern: '**/*.{json,jsonc}', icon: 'file-json' },
  { pattern: '**/*.{md,mdx,txt,log}', icon: 'file-text' },
  { pattern: '**/*.{png,jpg,jpeg,gif,webp,svg,bmp,avif}', icon: 'file-image' },
  { pattern: '**/*.{mp3,wav,ogg,flac,m4a}', icon: 'file-music' },
  { pattern: '**/*.{ttf,otf,woff,woff2}', icon: 'file-type' },
  { pattern: '**/*.wasm', icon: 'box' },
];
