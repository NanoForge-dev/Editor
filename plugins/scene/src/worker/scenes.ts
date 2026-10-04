import {
  type ClassDeclaration,
  type JSDocTag,
  Node,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
  type TypeNode,
} from 'ts-morph';

import type { AnalyzeContext } from '@nanoforge-dev/editor-sdk/worker';

import type {
  AppScenesModel,
  LibraryModel,
  SceneModel,
  SceneParam,
  ScenesAnalyzeArgs,
} from '../model/scene-model.type';

/** The engine's scene base classes, by module. */
const BASES: Record<string, { name: string; ecs: boolean }> = {
  '@nanoforge-dev/scene': { name: 'Scene', ecs: false },
  '@nanoforge-dev/ecs/scene': { name: 'EcsScene', ecs: true },
};

/** Project path of a file (the worker's files live under `/project/`). */
export const projectPath = (file: SourceFile): string =>
  file.getFilePath().replace(/^\/project\//, '');

interface ImportedName {
  readonly module: string;
  /** The exported name (`Scene` of `import { Scene as Base }`). */
  readonly name: string;
  readonly file?: SourceFile;
}

/** Where a name used in a file comes from, when it is imported. */
const importOf = (file: SourceFile, local: string): ImportedName | undefined => {
  for (const declaration of file.getImportDeclarations()) {
    const named = declaration
      .getNamedImports()
      .find((specifier) => (specifier.getAliasNode()?.getText() ?? specifier.getName()) === local);
    if (named)
      return {
        module: declaration.getModuleSpecifierValue(),
        name: named.getName(),
        file: declaration.getModuleSpecifierSourceFile(),
      };
  }
  return undefined;
};

/** A class declaration a name refers to: in the same file, or imported from a project file. */
export const classNamed = (file: SourceFile, local: string): ClassDeclaration | undefined => {
  const own = file.getClass(local);
  if (own) return own;
  const imported = importOf(file, local);
  return imported?.file?.getClass(imported.name);
};

export interface SceneBase {
  readonly ecs: boolean;
  /** The type argument given to `Scene` / `EcsScene`, if any. */
  readonly params?: TypeNode;
  /** The class and its project base classes, the class first. */
  readonly chain: readonly ClassDeclaration[];
}

/** Whether a class is a scene: it extends `Scene` or `EcsScene`, through project classes. */
export const sceneBase = (
  declaration: ClassDeclaration,
  seen = new Set<ClassDeclaration>(),
): SceneBase | undefined => {
  if (seen.has(declaration)) return undefined;
  seen.add(declaration);
  const heritage = declaration.getExtends();
  const expression = heritage?.getExpression();
  if (!heritage || !expression || !Node.isIdentifier(expression)) return undefined;
  const file = declaration.getSourceFile();
  const local = expression.getText();
  const imported = importOf(file, local);
  const engine = imported ? BASES[imported.module] : undefined;
  if (engine && imported?.name === engine.name) {
    const [params] = heritage.getTypeArguments();
    return { ecs: engine.ecs, ...(params && { params }), chain: [declaration] };
  }
  const base = classNamed(file, local);
  const inner = base ? sceneBase(base, seen) : undefined;
  return inner && { ...inner, chain: [declaration, ...inner.chain] };
};

/** The class a `static parent = X` names, its own or a base class's. */
const parentOf = (chain: readonly ClassDeclaration[]): string | undefined => {
  for (const declaration of chain) {
    const initializer = declaration.getStaticProperty('parent');
    const value =
      initializer && Node.isPropertyDeclaration(initializer)
        ? initializer.getInitializer()
        : undefined;
    if (value && Node.isIdentifier(value)) {
      const local = value.getText();
      return importOf(declaration.getSourceFile(), local)?.name ?? local;
    }
  }
  return undefined;
};

const docOf = (declaration: ClassDeclaration) => {
  const doc = declaration.getJsDocs().at(-1);
  const tags = doc?.getTags() ?? [];
  const tagText = (tag: JSDocTag | undefined) =>
    (tag?.getCommentText() ?? '').replace(/\s+/g, ' ').trim();
  const find = (name: string) => tags.find((tag) => tag.getTagName() === name);
  const description = doc
    ?.getDescription()
    .trim()
    .split(/\n\s*\n/)[0]
    ?.replace(/\s+/g, ' ');
  const vars = tagText(find('vars'))
    .split(/[\s,]+/)
    .filter(Boolean);
  return {
    ...(description && { description }),
    tagged: !!find('scene'),
    ...(find('side') && { side: tagText(find('side')) }),
    vars,
  };
};

const paramsOf = (type: TypeNode | undefined): SceneParam[] => {
  if (!type || !Node.isTypeLiteral(type)) return [];
  return type.getProperties().map((property) => {
    const description = property.getJsDocs().at(-1)?.getDescription().trim().replace(/\s+/g, ' ');
    return {
      name: property.getName(),
      type: property.getTypeNode()?.getText() ?? 'unknown',
      optional: property.hasQuestionToken(),
      ...(description && { description }),
    };
  });
};

/** `new SceneLibrary({ … })` in a file. */
export const findLibrary = (
  file: SourceFile,
): { options?: ObjectLiteralExpression; line: number } | undefined => {
  const created = file
    .getDescendantsOfKind(SyntaxKind.NewExpression)
    .find((expression) => expression.getExpression().getText() === 'SceneLibrary');
  if (!created) return undefined;
  const [first] = created.getArguments();
  return {
    ...(first && Node.isObjectLiteralExpression(first) && { options: first }),
    line: created.getStartLineNumber(),
  };
};

const libraryOf = (file: SourceFile): LibraryModel | undefined => {
  const found = findLibrary(file);
  if (!found) return undefined;
  const { options } = found;
  const property = (name: string) => options?.getProperty(name);
  const initialProperty = property('initial');
  const initial =
    initialProperty && Node.isShorthandPropertyAssignment(initialProperty)
      ? initialProperty.getName()
      : initialProperty && Node.isPropertyAssignment(initialProperty)
        ? initialProperty.getInitializer()?.getText()
        : undefined;
  const scenesProperty = property('scenes');
  const map =
    scenesProperty && Node.isPropertyAssignment(scenesProperty)
      ? scenesProperty.getInitializer()
      : undefined;
  const scenes: Record<string, string> = {};
  if (map && Node.isObjectLiteralExpression(map)) {
    for (const entry of map.getProperties()) {
      if (Node.isShorthandPropertyAssignment(entry)) scenes[entry.getName()] = entry.getName();
      else if (Node.isPropertyAssignment(entry)) {
        const value = entry.getInitializer();
        if (value && Node.isIdentifier(value))
          scenes[entry.getName().replace(/^['"]|['"]$/g, '')] = value.getText();
      }
    }
  }
  return {
    ...(initial && { initial }),
    scenes,
    hasScenes: !!map && Node.isObjectLiteralExpression(map),
    line: found.line,
  };
};

/**
 * The scenes of an app (classes of its folder extending `Scene` or `EcsScene`, or tagged
 * `@scene`) and the `SceneLibrary` of its entry file (the analyzed file).
 */
export const analyzeScenes = (context: AnalyzeContext, rawArgs: unknown): AppScenesModel => {
  const { root } = rawArgs as ScenesAnalyzeArgs;
  const prefix = root ? `${root}/` : '';
  const library = libraryOf(context.file);
  const idOf = (className: string) =>
    Object.entries(library?.scenes ?? {}).find(([, value]) => value === className)?.[0] ??
    className;

  const scenes: SceneModel[] = [];
  for (const file of context.project.getSourceFiles()) {
    const path = projectPath(file);
    if (!path.startsWith(prefix) || path.includes('/node_modules/') || path.endsWith('.d.ts'))
      continue;
    for (const declaration of file.getClasses()) {
      const className = declaration.getName();
      if (!className || !declaration.isExported() || declaration.isAbstract()) continue;
      const base = sceneBase(declaration);
      const doc = docOf(declaration);
      if (!base && !doc.tagged) continue;
      const params = base?.params;
      const parent = base ? parentOf(base.chain) : undefined;
      scenes.push({
        id: idOf(className),
        className,
        path,
        line: declaration.getStartLineNumber(),
        ...(parent && { parent }),
        ecs: base?.ecs ?? false,
        ownSetup: !!declaration.getMethod('setup'),
        ...(params && { paramsType: params.getText() }),
        params: paramsOf(params),
        ...doc,
      });
    }
  }
  scenes.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);

  const problems: string[] = [];
  if (library?.hasScenes) {
    const listed = new Set(Object.values(library.scenes));
    for (const scene of scenes)
      if (!listed.has(scene.className))
        problems.push(`${scene.className} is not in the scenes of SceneLibrary.`);
    for (const [id, className] of Object.entries(library.scenes))
      if (!scenes.some((scene) => scene.className === className))
        problems.push(`The scene "${id}" of SceneLibrary is not a scene class of this app.`);
  }
  for (const scene of scenes)
    if (scene.parent && !scenes.some((candidate) => candidate.className === scene.parent))
      problems.push(`${scene.className}'s parent ${scene.parent} is not a scene of this app.`);
  return { scenes, ...(library && { library }), problems };
};
