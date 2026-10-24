import { readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import ts from 'typescript';
import { unrun } from 'unrun';

import { type NanoforgeConfig, resolveConfig } from '@nanoforge-dev/config';

export const CONFIG_FILES = [
  'nanoforge.config.ts',
  'nanoforge.config.mts',
  'nanoforge.config.js',
  'nanoforge.config.mjs',
];

export type ResolvedConfig = ReturnType<typeof resolveConfig>;

/** Loads a `nanoforge.config.*` file into a fully resolved config. */
export interface ConfigLoader {
  load(file: string): Promise<ResolvedConfig>;
}

export class ConfigLoadError extends Error {
  constructor(
    readonly file: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

const CONFIG_MODULE_ID = '\0nanoforge-config';

/**
 * `@nanoforge-dev/config` as seen by configs: `defineConfig` is the identity, so configs load
 * even before the project's dependencies are installed (fresh clone).
 */
const configModulePlugin = {
  name: 'nanoforge-config-module',
  resolveId: (id: string) => (id === '@nanoforge-dev/config' ? CONFIG_MODULE_ID : null),
  load: (id: string) =>
    id === CONFIG_MODULE_ID ? 'export const defineConfig = (config) => config;' : null,
};

/**
 * Executes the config like the CLI does (local editor: the user trusts their own project).
 *
 * Everything but Node built-ins is bundled: unrun imports its bundle from
 * `<process cwd>/node_modules/.unrun`, so external packages would resolve from the editor's
 * working directory instead of the project.
 */
export const executingConfigLoader: ConfigLoader = {
  async load(file) {
    let module: { default?: unknown };
    try {
      ({ module } = await unrun<{ default?: unknown }>({
        path: file,
        preset: 'bundle-require',
        inputOptions: {
          external: (id: string) => BUILTINS.has(id),
          plugins: [configModulePlugin],
        },
      }));
    } catch (error) {
      throw new ConfigLoadError(
        file,
        `Failed to load ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return validate(module.default, file);
  },
};

const CONFIG_TYPES = new Set(['workspace', 'client', 'server', 'lib']);

/**
 * Reads the config without executing it: only `export default defineConfig({...})` or
 * `export default {...}` with literal values is supported. Used when projects are untrusted
 * (hosted ONLINE editor).
 */
export const staticConfigLoader: ConfigLoader = {
  async load(file) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    let expression: ts.Expression | undefined;
    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals)
        expression = statement.expression;
    }
    if (!expression) throw new ConfigLoadError(file, 'Config file has no default export');
    if (ts.isCallExpression(expression) && expression.arguments.length === 1) {
      expression = expression.arguments[0]!;
    }
    return validate(literal(expression, file), file);
  },
};

const validate = (value: unknown, file: string): ResolvedConfig => {
  if (value === undefined) throw new ConfigLoadError(file, 'Config file has no default export');
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigLoadError(file, 'The default export must be an object');
  }
  const type = (value as { type?: unknown }).type;
  if (typeof type !== 'string' || !CONFIG_TYPES.has(type)) {
    throw new ConfigLoadError(file, `Unknown config type ${JSON.stringify(type)}`);
  }
  return resolveConfig(value as NanoforgeConfig);
};

const literal = (node: ts.Expression, file: string): unknown => {
  const fail = (): never => {
    const { line, character } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
    throw new ConfigLoadError(
      file,
      `Only literal values are supported in configs of online projects (${line + 1}:${character + 1}: ${node.getText()})`,
    );
  };
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return literal(node.expression, file);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map((element) => literal(element, file));
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) return fail();
      const name = property.name;
      const key =
        ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
          ? name.text
          : fail();
      result[key] = literal(property.initializer, file);
    }
    return result;
  }
  return fail();
};
