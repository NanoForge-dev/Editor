export type MessageParams = Readonly<Record<string, string | number | boolean>>;

/**
 * Minimal ICU message formatting: `{name}`, `{count, plural, one {# item} other {# items}}`
 * (with `=N` exact matches) and `{kind, select, file {…} other {…}}`. `'{'` escapes a brace.
 */
export const formatMessage = (message: string, params: MessageParams = {}, locale = 'en'): string =>
  format(message, params, locale, undefined);

const format = (
  message: string,
  params: MessageParams,
  locale: string,
  pluralValue: number | undefined,
): string => {
  let result = '';
  let i = 0;
  while (i < message.length) {
    const char = message[i]!;
    if (char === "'" && message[i + 1] === '{') {
      result += '{';
      i += 2;
    } else if (char === '#' && pluralValue !== undefined) {
      result += new Intl.NumberFormat(locale).format(pluralValue);
      i++;
    } else if (char === '{') {
      const end = matchingBrace(message, i);
      result += formatArgument(message.slice(i + 1, end), params, locale);
      i = end + 1;
    } else {
      result += char;
      i++;
    }
  }
  return result;
};

const matchingBrace = (text: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  throw new Error(`Unbalanced braces in message "${text}"`);
};

const formatArgument = (argument: string, params: MessageParams, locale: string): string => {
  const [name = '', type, ...rest] = argument.split(',');
  const key = name.trim();
  const value = params[key];
  if (type === undefined) return value === undefined ? `{${key}}` : String(value);

  const options = parseOptions(rest.join(','));
  const kind = type.trim();
  if (kind === 'plural') {
    const count = Number(value ?? 0);
    const branch =
      options.get(`=${count}`) ??
      options.get(new Intl.PluralRules(locale).select(count)) ??
      options.get('other') ??
      '';
    return format(branch, params, locale, count);
  }
  if (kind === 'select') {
    const branch = options.get(String(value)) ?? options.get('other') ?? '';
    return format(branch, params, locale, undefined);
  }
  return value === undefined ? `{${key}}` : String(value);
};

/** `one {…} other {…}` → Map { one → …, other → … } */
const parseOptions = (text: string): Map<string, string> => {
  const options = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    while (/\s/.test(text[i] ?? '')) i++;
    const start = i;
    while (i < text.length && text[i] !== '{' && !/\s/.test(text[i]!)) i++;
    const selector = text.slice(start, i);
    while (/\s/.test(text[i] ?? '')) i++;
    if (!selector || text[i] !== '{') break;
    const end = matchingBrace(text, i);
    options.set(selector, text.slice(i + 1, end));
    i = end + 1;
  }
  return options;
};
