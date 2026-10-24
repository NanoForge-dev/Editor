import { WhenParseError } from './when-parse.exception';
import { type Token, tokenize } from './when-tokenizer';
import type { ContextReader, WhenExpression } from './when.type';

type Node = (read: ContextReader) => boolean;

const includes = (container: unknown, value: unknown): boolean => {
  if (Array.isArray(container)) return container.includes(value);
  if (typeof container === 'string') return typeof value === 'string' && container.includes(value);
  if (container && typeof container === 'object') {
    return typeof value === 'string' && Object.hasOwn(container, value);
  }
  return false;
};

const parse = (source: string): { node: Node; keys: Set<string> } => {
  const tokens = tokenize(source);
  const keys = new Set<string>();
  let index = 0;
  const peek = () => tokens[index]!;
  const next = () => tokens[index++]!;
  const fail = (token: Token, message: string): never => {
    throw new WhenParseError(source, token.pos, message);
  };
  const isOp = (token: Token, value: string) => token.kind === 'op' && token.value === value;

  const parseOr = (): Node => {
    let left = parseAnd();
    while (isOp(peek(), '||')) {
      next();
      const l = left;
      const r = parseAnd();
      left = (read) => l(read) || r(read);
    }
    return left;
  };

  const parseAnd = (): Node => {
    let left = parseUnary();
    while (isOp(peek(), '&&')) {
      next();
      const l = left;
      const r = parseUnary();
      left = (read) => l(read) && r(read);
    }
    return left;
  };

  const parseUnary = (): Node => {
    if (isOp(peek(), '!')) {
      next();
      const operand = parseUnary();
      return (read) => !operand(read);
    }
    return parsePrimary();
  };

  const parseValue = (): unknown => {
    const token = next();
    switch (token.kind) {
      case 'string':
      case 'number':
      case 'bool':
        return token.value;
      case 'key':
        return token.value;
      default:
        return fail(token, 'expected a value');
    }
  };

  const parsePrimary = (): Node => {
    const token = next();
    if (isOp(token, '(')) {
      const inner = parseOr();
      if (!isOp(next(), ')')) fail(tokens[index - 1]!, 'expected ")"');
      return inner;
    }
    if (token.kind === 'bool') {
      const value = token.value;
      return () => value;
    }
    if (token.kind !== 'key') return fail(token, 'expected a context key');

    const key = token.value;
    keys.add(key);
    const operator = peek();
    if (isOp(operator, '==') || isOp(operator, '!=')) {
      next();
      const expected = parseValue();
      const negate = operator.kind === 'op' && operator.value === '!=';
      return (read) => {
        const actual = read(key);
        const equal = actual === expected || String(actual) === String(expected);
        return negate ? !equal : equal;
      };
    }
    if (isOp(operator, '=~')) {
      next();
      const regex = next();
      if (regex.kind !== 'regex') return fail(regex, 'expected a regular expression');
      const pattern = regex.value;
      return (read) => {
        const actual = read(key);
        return typeof actual === 'string' && pattern.test(actual);
      };
    }
    if (isOp(operator, 'in')) {
      next();
      const container = next();
      if (container.kind !== 'key') return fail(container, 'expected a context key after "in"');
      keys.add(container.value);
      return (read) => includes(read(container.value), read(key));
    }
    return (read) => Boolean(read(key));
  };

  const node = parseOr();
  const end = peek();
  if (end.kind !== 'end') fail(end, 'unexpected token');
  return { node, keys };
};

const cache = new Map<string, WhenExpression>();

/** Parses (and caches) a when clause. Throws `WhenParseError` on invalid syntax. */
export const parseWhen = (source: string): WhenExpression => {
  const cached = cache.get(source);
  if (cached) return cached;
  const { node, keys } = parse(source);
  const expression: WhenExpression = { source, keys, evaluate: node };
  cache.set(source, expression);
  return expression;
};
