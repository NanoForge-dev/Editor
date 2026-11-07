import type { EngineWorld, EngineWorldValue } from '@nanoforge-dev/editor-sdk';

export type WorldEntity = EngineWorld['entities'][number];

type Operator = '=' | '!=' | '>' | '>=' | '<' | '<=';

export type QueryTerm =
  | { readonly kind: 'id'; readonly id: number }
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'field';
      /** Undefined: a field of any component. */
      readonly component?: string;
      readonly field?: string;
      readonly compare?: { readonly operator: Operator; readonly value: string };
    };

const TERM =
  /#(\d+)|"([^"]*)"|([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?(?:\s*(!=|>=|<=|=|>|<)\s*("[^"]*"|[^\s"]+))?/g;

/**
 * Terms of a world query, all of which an entity must match:
 * `#12`, `"text"`, `Position`, `Position.x`, `Position.x > 100`, `x > 100`.
 * A single name is a component name, or a field of any component.
 */
export const parseQuery = (query: string): QueryTerm[] => {
  const terms: QueryTerm[] = [];
  for (const match of query.matchAll(TERM)) {
    const [, id, text, first, second, operator, raw] = match;
    if (id !== undefined) terms.push({ kind: 'id', id: Number(id) });
    else if (text !== undefined) {
      if (text) terms.push({ kind: 'text', text: text.toLowerCase() });
    } else if (first) {
      const compare = operator
        ? { operator: operator as Operator, value: raw!.replace(/^"|"$/g, '') }
        : undefined;
      terms.push({
        kind: 'field',
        ...(second ? { component: first, field: second } : { field: first }),
        ...(compare && { compare }),
      });
    }
  }
  return terms;
};

const compareValues = (actual: EngineWorldValue, operator: Operator, expected: string): boolean => {
  if (actual === null || typeof actual === 'object') return false;
  const number = Number(expected);
  const numeric = typeof actual === 'number' && expected.trim() !== '' && !Number.isNaN(number);
  const [a, b] = numeric ? [actual, number] : [String(actual), expected];
  switch (operator) {
    case '=':
      return a === b;
    case '!=':
      return a !== b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
  }
};

const contains = (value: EngineWorldValue, text: string): boolean => {
  if (value === null) return false;
  if (typeof value !== 'object') return String(value).toLowerCase().includes(text);
  if (Array.isArray(value)) return value.some((item) => contains(item, text));
  return Object.entries(value).some(
    ([key, item]) => key.toLowerCase().includes(text) || contains(item, text),
  );
};

const matchesTerm = (entity: WorldEntity, term: QueryTerm): boolean => {
  switch (term.kind) {
    case 'id':
      return entity.id === term.id;
    case 'text':
      return entity.components.some(
        (component) =>
          component.name.toLowerCase().includes(term.text) || contains(component.value, term.text),
      );
    case 'field': {
      const { component, field, compare } = term;
      const lower = (text: string) => text.toLowerCase();
      if (component === undefined && field !== undefined && !compare) {
        return entity.components.some(
          (candidate) => lower(candidate.name).includes(lower(field)) || field in candidate.value,
        );
      }
      return entity.components.some((candidate) => {
        if (component !== undefined && lower(candidate.name) !== lower(component)) return false;
        if (field === undefined || !(field in candidate.value)) return false;
        return compare
          ? compareValues(candidate.value[field]!, compare.operator, compare.value)
          : true;
      });
    }
  }
};

/** Entities matching every term of the query (all of them when it is empty). */
export const filterEntities = (entities: readonly WorldEntity[], query: string): WorldEntity[] => {
  const terms = parseQuery(query);
  return terms.length
    ? entities.filter((entity) => terms.every((term) => matchesTerm(entity, term)))
    : [...entities];
};
