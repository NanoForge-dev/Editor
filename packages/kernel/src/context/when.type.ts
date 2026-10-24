/**
 * `when` clause expressions, e.g.
 * `editorFocus && screen == 'scene' && !engineLib:@nanoforge-dev/ecs`,
 * `resourceName =~ /\.component\.ts$/`, `selection in selectableKinds`.
 *
 * Grammar: or := and ('||' and)* ; and := unary ('&&' unary)* ; unary := '!' unary | primary ;
 * primary := '(' or ')' | operand (('=='|'!=') value | '=~' regex | 'in' key)?
 * A bare word on the right of `==`/`!=` is a string, as in VS Code.
 */
export type ContextValue =
  string | number | boolean | null | undefined | readonly unknown[] | object;

export type ContextReader = (key: string) => unknown;

export interface WhenExpression {
  readonly source: string;
  /** Keys read by the expression (to re-evaluate only on relevant changes). */
  readonly keys: ReadonlySet<string>;
  evaluate(read: ContextReader): boolean;
}
