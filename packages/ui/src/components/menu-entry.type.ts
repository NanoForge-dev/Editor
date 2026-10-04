/** Entries of dropdown and context menus. */
export type MenuEntry =
  | {
      readonly kind: 'item';
      readonly id: string;
      readonly label: string;
      readonly shortcut?: string;
      readonly icon?: string;
      readonly disabled?: boolean;
      readonly checked?: boolean;
      readonly onSelect: () => void;
    }
  | { readonly kind: 'separator' }
  | {
      readonly kind: 'submenu';
      readonly label: string;
      readonly items: readonly MenuEntry[];
      readonly disabled?: boolean;
    };
