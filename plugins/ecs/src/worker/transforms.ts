import { type Identifier, Node } from 'ts-morph';

import type { TransformContext } from '@nanoforge-dev/editor-sdk/worker';

import type { ScopedEntryOp } from '../model/ecs-model.type';
import { scopeName } from '../model/scope-name';
import { componentCall, setArgs } from './component-args';
import { ensureImports } from './ensure-imports';
import { componentExpression, parseEntry } from './entry-file';
import {
  IDENTIFIER,
  checkNewName,
  entityOf,
  fail,
  insertAfter,
  insertInEmpty,
  lastStatementOf,
  lineRange,
  literal,
  moveLines,
  uniqueName,
} from './transform-helpers';

/** Applies an `EntryOp` to the entry file (see `analyzeEntry`). */
export const transformEntry = (context: TransformContext, rawOp: unknown): void => {
  const op = rawOp as ScopedEntryOp;
  const where = scopeName(op.scope);
  const parsed =
    parseEntry(context.file, op.scope) ??
    fail(
      op.scope?.kind === 'method'
        ? `No \`${where}\` method in this file.`
        : 'No exported `main` function in this file.',
    );
  const registry = parsed.registry ?? fail(`No ECS registry found in \`${where}\`.`);
  const { edit } = context;

  switch (op.kind) {
    case 'addEntity': {
      const name = op.name
        ? (checkNewName(context, op.name), op.name)
        : uniqueName(context, 'entity');
      const text = `const ${name} = ${registry}.spawnEntity();`;
      const last = parsed.entities.at(-1);
      if (last) insertAfter(context, lastStatementOf(last), text);
      else {
        const anchor = parsed.main
          .getStatements()
          .find(
            (statement) =>
              Node.isVariableStatement(statement) &&
              statement.getDeclarations().some((declaration) => declaration.getName() === registry),
          );
        if (anchor) insertAfter(context, anchor, text);
        else {
          const first = parsed.main.getStatements()[0];
          if (first) edit.insertBefore(first, `${text}\n${edit.indentationOf(first)}`);
          else insertInEmpty(context, parsed.main, text);
        }
      }
      return;
    }
    case 'removeEntity': {
      const entity = entityOf(parsed, op.entity);
      const own = new Set<Node>([entity.declaration, ...entity.components]);
      const nameNode = entity.declaration.getDeclarations()[0]!.getNameNode();
      const elsewhere = (nameNode as Identifier)
        .findReferencesAsNodes()
        .filter((node) => node.getSourceFile() === context.file)
        .filter(
          (node) =>
            ![...own].some((statement) => statement.containsRange(node.getStart(), node.getEnd())),
        );
      if (elsewhere.length)
        fail(
          `"${entity.name}" is used elsewhere in the code (line ${elsewhere[0]!.getStartLineNumber()}). Remove those uses first.`,
        );
      for (const statement of own) edit.removeLines(statement);
      return;
    }
    case 'renameEntity': {
      const entity = entityOf(parsed, op.entity);
      if (op.name === entity.name) return;
      checkNewName(context, op.name);
      const nameNode = entity.declaration.getDeclarations()[0]!.getNameNode() as Identifier;
      const nodes = new Set<Node>([nameNode, ...nameNode.findReferencesAsNodes()]);
      for (const node of nodes)
        if (node.getSourceFile() === context.file) edit.replace(node, op.name);
      return;
    }
    case 'duplicateEntity': {
      const entity = entityOf(parsed, op.entity);
      const name = op.name
        ? (checkNewName(context, op.name), op.name)
        : uniqueName(context, `${entity.name}Copy`);
      const indent = edit.indentationOf(entity.declaration);
      const lines = [
        `const ${name} = ${registry}.spawnEntity();`,
        ...entity.components.map(
          (statement) =>
            `${registry}.addComponent(${name}, ${componentExpression(statement).getText()});`,
        ),
      ];
      edit.insertAfter(lastStatementOf(entity), lines.map((line) => `\n${indent}${line}`).join(''));
      return;
    }
    case 'moveEntity': {
      const entity = entityOf(parsed, op.entity);
      const statements = parsed.main.getStatements();
      const indices = [entity.declaration, ...entity.components].map((statement) =>
        statements.indexOf(statement),
      );
      if (indices.some((index, position) => position > 0 && index !== indices[position - 1]! + 1))
        fail(
          `"${entity.name}" and its components aren't next to each other: move them in the code.`,
        );
      if (op.before === entity.name) return;
      if (op.before)
        moveLines(
          context,
          entity.declaration,
          lastStatementOf(entity),
          entityOf(parsed, op.before).declaration,
        );
      else {
        const last = parsed.entities.at(-1)!;
        if (last === entity) return;
        moveLines(
          context,
          entity.declaration,
          lastStatementOf(entity),
          lineRange(context, lastStatementOf(last), lastStatementOf(last)).end,
        );
      }
      return;
    }
    case 'addComponent': {
      const entity = entityOf(parsed, op.entity);
      if (!IDENTIFIER.test(op.className)) fail(`"${op.className}" isn't a class name.`);
      const indent = edit.indentationOf(entity.declaration);
      const args = op.args.map((arg) => literal(context, arg, indent)).join(', ');
      insertAfter(
        context,
        lastStatementOf(entity),
        `${registry}.addComponent(${entity.name}, new ${op.className}(${args}));`,
      );
      ensureImports(context, op.imports);
      return;
    }
    case 'removeComponent': {
      const entity = entityOf(parsed, op.entity);
      edit.removeLines(
        entity.components[op.index] ?? fail(`"${entity.name}" has no component ${op.index}.`),
      );
      return;
    }
    case 'moveComponent': {
      const entity = entityOf(parsed, op.entity);
      const from =
        entity.components[op.from] ?? fail(`"${entity.name}" has no component ${op.from}.`);
      const to = entity.components[op.to] ?? fail(`"${entity.name}" has no component ${op.to}.`);
      if (from === to) return;
      if (op.to < op.from) moveLines(context, from, from, to);
      else moveLines(context, from, from, lineRange(context, to, to).end);
      return;
    }
    case 'setArgs': {
      const entity = entityOf(parsed, op.entity);
      const statement =
        entity.components[op.index] ?? fail(`"${entity.name}" has no component ${op.index}.`);
      setArgs(context, statement, op.args, op.fill ?? []);
      if (op.imports?.length) ensureImports(context, op.imports);
      return;
    }
    case 'addSystem': {
      if (!IDENTIFIER.test(op.name)) fail(`"${op.name}" isn't a function name.`);
      const text = `${registry}.addSystem(${op.name});`;
      const last =
        parsed.systems.at(-1) ??
        parsed.entities.at(-1)?.components.at(-1) ??
        parsed.entities.at(-1)?.declaration;
      const anchor = last ?? parsed.main.getStatements().at(-1);
      if (anchor) insertAfter(context, anchor, text);
      else insertInEmpty(context, parsed.main, text);
      ensureImports(context, op.imports);
      return;
    }
    case 'removeSystem': {
      edit.removeLines(parsed.systems[op.index] ?? fail(`There is no system ${op.index}.`));
      return;
    }
    case 'moveSystem': {
      const from = parsed.systems[op.from] ?? fail(`There is no system ${op.from}.`);
      const to = parsed.systems[op.to] ?? fail(`There is no system ${op.to}.`);
      if (from === to) return;
      if (op.to < op.from) moveLines(context, from, from, to);
      else moveLines(context, from, from, lineRange(context, to, to).end);
      return;
    }
  }
};

export { componentCall };
