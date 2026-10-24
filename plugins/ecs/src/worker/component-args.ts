import { type CallExpression, type ExpressionStatement, type NewExpression, Node } from 'ts-morph';

import type { TransformContext } from '@nanoforge-dev/editor-sdk/worker';

import type { ArgValue } from '../model/ecs-model.type';
import { componentExpression } from './entry-file';
import { fail, literal } from './transform-helpers';

export const componentCall = (statement: ExpressionStatement): CallExpression =>
  statement.getExpression() as CallExpression;

/** Rewrites `new X(...)` arguments: in place when they exist, else the whole argument list. */
export const setArgs = (
  context: TransformContext,
  statement: ExpressionStatement,
  args: Readonly<Record<number, ArgValue>>,
  fill: readonly ArgValue[],
) => {
  const expression = componentExpression(statement);
  if (!Node.isNewExpression(expression))
    fail('This component is not `new X(...)`: edit it in the code.');
  const existing = (expression as NewExpression).getArguments() as Node[];
  const indent = context.edit.indentationOf(statement);
  const positions = Object.keys(args).map(Number);
  if (positions.every((position) => position < existing.length)) {
    for (const position of positions)
      context.edit.replace(existing[position]!, literal(context, args[position]!, indent));
    return;
  }
  const count = Math.max(existing.length, ...positions.map((position) => position + 1));
  const list = Array.from({ length: count }, (_, position) =>
    args[position] !== undefined
      ? literal(context, args[position], indent)
      : (existing[position]?.getText() ??
        (fill[position] ? literal(context, fill[position], indent) : 'undefined')),
  );
  const callee = (expression as NewExpression).getExpression().getText();
  context.edit.replace(expression, `new ${callee}(${list.join(', ')})`);
};
