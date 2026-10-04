import { WhenParseError } from './when-parse.exception';

export type Token =
  | { kind: 'op'; value: '(' | ')' | '!' | '&&' | '||' | '==' | '!=' | '=~' | 'in'; pos: number }
  | { kind: 'key'; value: string; pos: number }
  | { kind: 'string'; value: string; pos: number }
  | { kind: 'number'; value: number; pos: number }
  | { kind: 'bool'; value: boolean; pos: number }
  | { kind: 'regex'; value: RegExp; pos: number }
  | { kind: 'end'; pos: number };

const KEY_START = /[A-Za-z_@$]/;
const KEY_CHAR = /[\w.:@/$-]/;

export const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  const fail = (pos: number, message: string): never => {
    throw new WhenParseError(source, pos, message);
  };
  let i = 0;
  while (i < source.length) {
    const char = source[i]!;
    const two = source.slice(i, i + 2);
    if (/\s/.test(char)) {
      i++;
    } else if (two === '&&' || two === '||' || two === '==' || two === '!=') {
      tokens.push({ kind: 'op', value: two, pos: i });
      i += 2;
    } else if (two === '=~') {
      tokens.push({ kind: 'op', value: '=~', pos: i });
      i += 2;
      while (/\s/.test(source[i] ?? '')) i++;
      if (source[i] !== '/') fail(i, 'expected a regular expression after =~');
      const start = i++;
      let pattern = '';
      while (i < source.length && source[i] !== '/') {
        if (source[i] === '\\') pattern += source[i++];
        pattern += source[i++] ?? '';
      }
      if (source[i] !== '/') fail(start, 'unterminated regular expression');
      i++;
      let flags = '';
      while (/[a-z]/.test(source[i] ?? '')) flags += source[i++];
      try {
        tokens.push({ kind: 'regex', value: new RegExp(pattern, flags), pos: start });
      } catch (error) {
        fail(start, String(error));
      }
    } else if (char === '(' || char === ')' || char === '!') {
      tokens.push({ kind: 'op', value: char, pos: i++ });
    } else if (char === "'" || char === '"') {
      const start = i++;
      let value = '';
      while (i < source.length && source[i] !== char) {
        if (source[i] === '\\') i++;
        value += source[i++] ?? '';
      }
      if (source[i] !== char) fail(start, 'unterminated string');
      i++;
      tokens.push({ kind: 'string', value, pos: start });
    } else if (/[\d-]/.test(char)) {
      const match = /^-?\d+(\.\d+)?/.exec(source.slice(i));
      if (!match) fail(i, `unexpected "${char}"`);
      tokens.push({ kind: 'number', value: Number(match![0]), pos: i });
      i += match![0].length;
    } else if (KEY_START.test(char)) {
      const start = i;
      while (i < source.length && KEY_CHAR.test(source[i]!)) i++;
      const word = source.slice(start, i);
      if (word === 'true' || word === 'false') {
        tokens.push({ kind: 'bool', value: word === 'true', pos: start });
      } else if (word === 'in') {
        tokens.push({ kind: 'op', value: 'in', pos: start });
      } else {
        tokens.push({ kind: 'key', value: word, pos: start });
      }
    } else {
      fail(i, `unexpected "${char}"`);
    }
  }
  tokens.push({ kind: 'end', pos: source.length });
  return tokens;
};
