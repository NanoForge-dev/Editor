import type { ContentBrowserItem } from '../Widget/ContentBrowser/types';

export const entities: ContentBrowserItem[] = [
  {
    id: 'id1',
    name: 'Content',
    type: 'folder',
    children: [
      {
        id: 'id2',
        name: 'JumpOut',
        type: 'folder',
        children: [
          {
            id: 'id3',
            name: 'Player',
            type: 'folder',
            children: [
              {
                id: 'id4',
                name: 'Meshes',
                type: 'folder',
                children: [
                  {
                    id: 'id5',
                    name: 'Character.fbx',
                    type: 'fbx',
                  },
                ],
              },
              {
                id: 'id6',
                name: 'Systems.ts',
                type: 'ts',
              },
            ],
          },
        ],
      },
    ],
  },
];
