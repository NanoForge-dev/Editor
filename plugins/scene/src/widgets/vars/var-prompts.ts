import type { PromptService } from '@nanoforge-dev/editor-sdk/ui';

import type { VarModel } from '../../model/vars-model.type';

export interface NewVar {
  readonly name: string;
  readonly type: string;
  readonly fallback: string;
  readonly description: string;
}

export type VarField = 'rename' | 'type' | 'default' | 'description';

/** Asks for a new var (or the type of one used but not declared): name, type, default, description. */
export const askNewVar = async (
  prompts: PromptService,
  nameProblem: (value: string) => string | undefined,
  key?: string,
  type?: string,
): Promise<NewVar | undefined> => {
  const name =
    key ??
    (await prompts.ask({
      title: 'Add var',
      label: 'Name',
      value: 'score',
      confirm: 'Next',
      validate: (value) => nameProblem(value),
    }));
  if (!name) return undefined;
  const chosenType = await prompts.ask({
    title: `Type of ${name}`,
    label: 'Type',
    value: type ?? 'number',
    confirm: 'Next',
    validate: (value) => (value.trim() ? undefined : 'Give a type: number, string, boolean…'),
  });
  if (!chosenType) return undefined;
  const fallback = await prompts.ask({
    title: `Default of ${name}`,
    label: 'Default (optional)',
    value: chosenType === 'number' ? '0' : '',
    confirm: 'Next',
    optional: true,
  });
  if (fallback === undefined) return undefined;
  const description = await prompts.ask({
    title: `Description of ${name}`,
    label: 'Description (optional)',
    value: '',
    confirm: key ? 'Declare' : 'Add',
    optional: true,
  });
  if (description === undefined) return undefined;
  return {
    name,
    type: chosenType.trim(),
    description: description.trim(),
    fallback: fallback.trim(),
  };
};

const LABELS = {
  rename: 'Name',
  type: 'Type',
  default: 'Default',
  description: 'Description',
} as const;

/** Asks for a new value of one of a var's fields; undefined when cancelled or unchanged. */
export const askVarField = async (
  prompts: PromptService,
  field: VarModel,
  what: VarField,
  nameProblem: (value: string, current?: string) => string | undefined,
): Promise<string | undefined> => {
  const current = {
    rename: field.name,
    type: field.type,
    default: field.default ?? '',
    description: field.description ?? '',
  }[what];
  const value = await prompts.ask({
    title: what === 'rename' ? `Rename ${field.name}` : `${LABELS[what]} of ${field.name}`,
    label: LABELS[what],
    value: current,
    confirm: what === 'rename' ? 'Rename' : 'Save',
    optional: what === 'default' || what === 'description',
    ...(what === 'rename' && { validate: (next: string) => nameProblem(next, field.name) }),
  });
  return value === undefined || value === current ? undefined : value.trim();
};
