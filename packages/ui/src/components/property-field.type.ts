export type PropertyField = {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly readonly?: boolean;
} & (
  | { readonly type: 'string'; readonly placeholder?: string }
  | {
      readonly type: 'number';
      readonly step?: number;
      readonly min?: number;
      readonly max?: number;
      readonly precision?: number;
    }
  | { readonly type: 'boolean' }
  | { readonly type: 'color' }
  | { readonly type: 'vector2'; readonly step?: number }
  | { readonly type: 'enum'; readonly options: readonly { value: string; label: string }[] }
  | { readonly type: 'json' }
);
