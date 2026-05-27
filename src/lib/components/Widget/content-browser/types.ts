export type ContentBrowserItem = ContentBrowserItemFile | ContentBrowserItemDir;

export type ContentBrowserItemBase = {
  name: string;
};

export type ContentBrowserItemFile = ContentBrowserItemBase & {
  type: 'file';
};

export type ContentBrowserItemDir = ContentBrowserItemBase & {
  type: 'dir';
  children: ContentBrowserItem[];
};
