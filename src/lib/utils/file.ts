import type { TabTypeId } from '$lib/components/Tabs/types';

const FILE_TYPES: [TabTypeId, string[]][] = [
  ['ts', ['ts', 'js']],
  ['3d', ['fbd']],
  ['song', ['mp3', 'wav', 'flac']],
  ['img', ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']],
];

export const getType = (name: string) => {
  const [type] = FILE_TYPES.find(([, exts]) => exts.includes(name.split('.').pop()!)) ?? [
    'unknown',
  ];
  return type;
};
