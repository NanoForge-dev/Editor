import { z } from 'zod';

import {
  COLOR_TOKENS,
  type ColorToken,
  SYNTAX_TOKENS,
  type SyntaxToken,
  THEME_TOKENS,
  type ThemeDefinition,
  type ThemeToken,
} from './tokens';

/**
 * A value goes into a stylesheet: nothing that ends its declaration or loads another file
 * (a theme brings no files but its icons).
 */
const UNSAFE = /[;{}\\<>@]|\b(?:url|image|image-set|src|element)\s*\(/i;
const CssValue = z
  .string()
  .min(1)
  .refine((value) => !UNSAFE.test(value), {
    message: 'is not a plain CSS value (no ; { } \\ < > @, url() nor images)',
  });

const partial = <T extends string>(names: readonly T[]) =>
  z.strictObject(
    Object.fromEntries(names.map((name) => [name, CssValue.optional()])),
  ) as unknown as z.ZodType<Partial<Record<T, string>>>;

/**
 * A theme as contributed (`contributes.themes`): complete, or `extends` another and gives only
 * what it changes. Unknown tokens are refused by name.
 */
export const ThemeContributionSchema = z
  .strictObject({
    id: z.string().regex(/^[\w-]+$/),
    label: z.string().min(1),
    /** Taken from the theme it extends when not given. */
    kind: z.enum(['dark', 'light']).optional(),
    /** The id of the theme it starts from (`nanoforge-dark`, or another plugin's). */
    extends: z.string().optional(),
    colors: partial(COLOR_TOKENS).default({}),
    syntax: partial(SYNTAX_TOKENS).optional(),
    tokens: partial(THEME_TOKENS).optional(),
  })
  .superRefine((theme, context) => {
    if (theme.extends) return;
    if (!theme.kind)
      context.addIssue({ code: 'custom', message: 'kind is needed when the theme extends none' });
    const missing = COLOR_TOKENS.filter((token) => !theme.colors[token]);
    if (missing.length)
      context.addIssue({
        code: 'custom',
        message: `colors lacks ${missing.join(', ')}: give every color, or extend a theme`,
      });
  });

export type ThemeContribution = z.output<typeof ThemeContributionSchema>;

/** Why a theme can't be resolved: its base is missing or extends it back. */
export class ThemeResolveError extends Error {}

/**
 * The complete themes from their contributions: each `extends` chain is followed (a base's
 * colors, code colors and tokens, then the theme's own). Themes that can't be resolved are
 * left out, with the reason given to `report`.
 */
export const resolveThemes = (
  contributions: readonly ThemeContribution[],
  report: (id: string, error: ThemeResolveError) => void = () => undefined,
): ThemeDefinition[] => {
  const byId = new Map(contributions.map((theme) => [theme.id, theme]));
  const resolved = new Map<string, ThemeDefinition>();
  const resolve = (id: string, chain: readonly string[]): ThemeDefinition => {
    const done = resolved.get(id);
    if (done) return done;
    if (chain.includes(id))
      throw new ThemeResolveError(`extends itself: ${[...chain, id].join(' → ')}`);
    const theme = byId.get(id);
    if (!theme)
      throw new ThemeResolveError(
        `extends ${id}, which no installed plugin contributes (${[...chain].join(' → ')})`,
      );
    const base = theme.extends ? resolve(theme.extends, [...chain, id]) : undefined;
    const syntax = { ...base?.syntax, ...theme.syntax } as Partial<Record<SyntaxToken, string>>;
    const tokens = { ...base?.tokens, ...theme.tokens } as Partial<Record<ThemeToken, string>>;
    const definition: ThemeDefinition = {
      id: theme.id,
      label: theme.label,
      kind: theme.kind ?? base!.kind,
      colors: { ...base?.colors, ...theme.colors } as Record<ColorToken, string>,
      ...(Object.keys(syntax).length && { syntax }),
      ...(Object.keys(tokens).length && { tokens }),
    };
    resolved.set(id, definition);
    return definition;
  };
  const themes: ThemeDefinition[] = [];
  for (const theme of contributions) {
    try {
      themes.push(resolve(theme.id, []));
    } catch (error) {
      if (error instanceof ThemeResolveError) report(theme.id, error);
      else throw error;
    }
  }
  return themes;
};
