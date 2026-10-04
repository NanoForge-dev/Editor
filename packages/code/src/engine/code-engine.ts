import { type Node, Project, ts } from 'ts-morph';

import type { ItemOwner } from '@nanoforge-dev/editor-meta';

import type { AnalyzeContext, Analyzer, CodeEngineOptions, Transformer } from './code-engine.type';
import { CodeError } from './code.exception';
import { EditBuilder } from './edit-builder';
import type { CodeDiagnostic, CodeSymbol, SourceText, TextEdit } from './engine.type';
import { type MetaRequest, type MetaResponse, extractMeta } from './extract-meta';
import { literalToValue, quoteStyle, readExportedLiteral, valueToLiteral } from './literals';
import { joinPosix, matchesPathPattern, moduleSpecifierFor } from './module-specifier';

const ROOT = '/project/';

const toFsPath = (path: string) => ROOT + path;
const toProjectPath = (fsPath: string) =>
  fsPath.startsWith(ROOT) ? fsPath.slice(ROOT.length) : fsPath;

/**
 * TypeScript analysis of a project mirrored in memory. Runs in a web worker; plugins register
 * analyzers (source → model) and transformers (operation → text edits).
 */
export class CodeEngine {
  readonly project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      checkJs: false,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      experimentalDecorators: true,
      lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    },
  });

  private readonly _analyzers = new Map<string, { owner: string; run: Analyzer }>();
  private readonly _transformers = new Map<string, { owner: string; run: Transformer }>();
  /**
   * Per package, where its declarations were found (the folders holding the `node_modules` they
   * are in) and the folders asked from. Each app of a workspace has its own `node_modules`: a
   * package loaded for the client is not visible from the server's files.
   */
  private readonly _typeRoots = new Map<string, { found: string[]; asked: Set<string> }>();
  private readonly _itemOwners = new Map<string, { plugin: string; owner: ItemOwner }>();
  private _paths: Readonly<Record<string, readonly string[]>> = {};
  /**
   * One program per app, for diagnostics, once the project has several apps with their own
   * `node_modules` (by app root; files outside of every app are in each of them). In one program the
   * client's type augmentations (`declare module`, globals) would apply to the server's code
   * and report errors `tsc` never shows. Built on demand, kept in step with `project`.
   */
  private _scopes: Map<string, Project> | undefined;

  constructor(private readonly _options: CodeEngineOptions = {}) {}

  setFiles(files: readonly SourceText[]): void {
    for (const { path, text } of files) {
      const existing = this.project.getSourceFile(toFsPath(path));
      if (existing) {
        if (existing.getFullText() !== text) existing.replaceWithText(text);
      } else {
        this.project.createSourceFile(toFsPath(path), text, { overwrite: true });
      }
      this._syncScopes(path, text);
    }
  }

  deleteFiles(paths: readonly string[]): void {
    for (const path of paths) {
      const file = this.project.getSourceFile(toFsPath(path));
      if (file) this.project.removeSourceFile(file);
      this._syncScopes(path, undefined);
    }
  }

  text(path: string): string | undefined {
    return this.project.getSourceFile(toFsPath(path))?.getFullText();
  }

  get paths(): string[] {
    return this.project.getSourceFiles().map((file) => toProjectPath(file.getFilePath()));
  }

  registerAnalyzer(id: string, run: Analyzer, owner = 'core'): () => void {
    if (this._analyzers.has(id)) throw new Error(`Analyzer "${id}" is already registered`);
    this._analyzers.set(id, { owner, run });
    return () => this._analyzers.delete(id);
  }

  registerTransformer(id: string, run: Transformer, owner = 'core'): () => void {
    if (this._transformers.has(id)) throw new Error(`Transformer "${id}" is already registered`);
    this._transformers.set(id, { owner, run });
    return () => this._transformers.delete(id);
  }

  /** Registers an owner of item data (ADR 0003), e.g. `@nanoforge/ecs` from the ECS plugin. */
  registerItemOwner(owner: ItemOwner, plugin = 'core'): () => void {
    if (this._itemOwners.has(owner.name))
      throw new Error(`Item owner "${owner.name}" is already registered`);
    this._itemOwners.set(owner.name, { plugin, owner });
    return () => this._itemOwners.delete(owner.name);
  }

  /** Names, versions and schemas of the registered item owners. */
  get itemOwners(): { name: string; version: string; schema: number }[] {
    return [...this._itemOwners.values()].map(({ owner }) => ({
      name: owner.name,
      version: owner.version,
      schema: owner.schema,
    }));
  }

  /** Items of a source (ADR 0003), with every registered owner. */
  async extractMeta(request: MetaRequest): Promise<MetaResponse> {
    if (request.texts?.length) this.setFiles(request.texts);
    for (const file of request.files) await this._loadTypes(file.path);
    return extractMeta(
      this.project,
      [...this._itemOwners.values()].map(({ owner }) => owner),
      request,
    );
  }

  /**
   * Applies the root `tsconfig.json`'s `paths` (package-name imports of shared libraries and
   * installed packages, ADR 0004). Other options stay the engine's.
   */
  setTsconfig(text: string | undefined): void {
    const parsed = text ? ts.parseConfigFileTextToJson(`${ROOT}tsconfig.json`, text) : undefined;
    const options = (parsed?.config as { compilerOptions?: { paths?: unknown; baseUrl?: unknown } })
      ?.compilerOptions;
    const paths: Record<string, string[]> = {};
    if (options?.paths && typeof options.paths === 'object') {
      const base = typeof options.baseUrl === 'string' ? options.baseUrl : '.';
      for (const [pattern, targets] of Object.entries(options.paths as Record<string, unknown>)) {
        if (!Array.isArray(targets)) continue;
        paths[pattern] = targets
          .filter((target): target is string => typeof target === 'string')
          .map((target) => joinPosix(base, target));
      }
    }
    this._paths = paths;
    this.project.compilerOptions.set({ baseUrl: ROOT, paths });
    this._scopes = undefined;
  }

  /** Removes every analyzer and transformer of a plugin (hot reload, disable). */
  unregisterOwner(owner: string): void {
    for (const [name, entry] of this._itemOwners)
      if (entry.plugin === owner) this._itemOwners.delete(name);
    for (const [id, entry] of this._analyzers)
      if (entry.owner === owner) this._analyzers.delete(id);
    for (const [id, entry] of this._transformers)
      if (entry.owner === owner) this._transformers.delete(id);
  }

  analyze(path: string, analyzerId: string, args?: unknown): unknown {
    const analyzer = this._analyzers.get(analyzerId);
    if (!analyzer) throw new CodeError(`Unknown analyzer "${analyzerId}"`);
    return analyzer.run(this._context(path), args);
  }

  /** Edits a transformer wants to make; the file itself is not changed here. */
  transform(path: string, transformerId: string, op: unknown): TextEdit[] {
    const transformer = this._transformers.get(transformerId);
    if (!transformer) throw new CodeError(`Unknown transformer "${transformerId}"`);
    const context = this._context(path);
    const edit = new EditBuilder(context.text);
    transformer.run({ ...context, edit }, op);
    return edit.build();
  }

  /** Edits sorting and removing unused imports of a file (TypeScript's organize imports). */
  async organizeImports(path: string): Promise<TextEdit[]> {
    await this._loadTypes(path);
    const changes = this.project
      .getLanguageService()
      .compilerObject.organizeImports({ type: 'file', fileName: toFsPath(path) }, {}, {});
    return changes
      .filter((change) => change.fileName === toFsPath(path))
      .flatMap((change) =>
        change.textChanges.map((edit) => ({
          start: edit.span.start,
          end: edit.span.start + edit.span.length,
          text: edit.newText,
        })),
      );
  }

  /** Named declarations of a file, in source order (TypeScript's navigation tree). */
  symbols(path: string): CodeSymbol[] {
    const file = this.project.getSourceFile(toFsPath(path))?.compilerNode;
    if (!file) return [];
    const tree = this.project.getLanguageService().compilerObject.getNavigationTree(toFsPath(path));
    const result: CodeSymbol[] = [];
    const visit = (node: ts.NavigationTree, container?: string) => {
      const span = node.nameSpan ?? node.spans[0];
      const named = node.kind !== 'script' && node.kind !== 'module' && !node.text.startsWith('<');
      if (named && span) {
        const position = file.getLineAndCharacterOfPosition(span.start);
        result.push({
          name: node.text,
          kind: node.kind,
          ...(container && { container }),
          line: position.line + 1,
          column: position.character + 1,
        });
      }
      for (const child of node.childItems ?? []) visit(child, named ? node.text : container);
    };
    visit(tree);
    return result.sort((a, b) => a.line - b.line || a.column - b.column);
  }

  /** TypeScript diagnostics of files (type declarations of bare imports are loaded first). */
  async diagnostics(paths: readonly string[]): Promise<CodeDiagnostic[]> {
    for (const path of paths) await this._loadTypes(path);
    const programs = new Map<Project, ts.Program>();
    const result: CodeDiagnostic[] = [];
    for (const path of paths) {
      const checked = this._checked(path);
      let program = programs.get(checked);
      if (!program) programs.set(checked, (program = checked.getProgram().compilerObject));
      const file = program.getSourceFile(toFsPath(path));
      if (!file) continue;
      for (const diagnostic of [
        ...program.getSyntacticDiagnostics(file),
        ...program.getSemanticDiagnostics(file),
      ]) {
        const position = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
        result.push({
          path,
          start: diagnostic.start ?? 0,
          length: diagnostic.length ?? 0,
          line: position.line + 1,
          column: position.character + 1,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          severity:
            diagnostic.category === ts.DiagnosticCategory.Error
              ? 'error'
              : diagnostic.category === ts.DiagnosticCategory.Warning
                ? 'warning'
                : 'info',
          code: diagnostic.code,
          source: 'typescript',
        });
      }
    }
    return result;
  }

  /** Roots of the apps that have their own `node_modules` (where type declarations were found). */
  private _scopeRoots(): string[] {
    const roots = new Set<string>();
    for (const { found } of this._typeRoots.values())
      for (const root of found) if (root) roots.add(root);
    return [...roots].sort();
  }

  private _scopeOf(path: string, roots: readonly string[]): string {
    return roots.find((root) => path === root || path.startsWith(`${root}/`)) ?? '';
  }

  /** The program a file is checked in: its app's, with the files outside of every app. */
  private _checked(path: string): Project {
    const roots = this._scopeRoots();
    if (roots.length < 2) return this.project;
    const scope = this._scopeOf(path, roots);
    if (!scope) return this.project;
    this._scopes ??= new Map();
    let project = this._scopes.get(scope);
    if (!project) {
      project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: this.project.getCompilerOptions(),
      });
      for (const file of this.project.getSourceFiles()) {
        const owner = this._scopeOf(toProjectPath(file.getFilePath()), roots);
        if (owner === '' || owner === scope)
          project.createSourceFile(file.getFilePath(), file.getFullText(), { overwrite: true });
      }
      this._scopes.set(scope, project);
    }
    return project;
  }

  private _syncScopes(path: string, text: string | undefined): void {
    if (!this._scopes) return;
    const roots = this._scopeRoots();
    const owner = this._scopeOf(path, roots);
    for (const [scope, project] of this._scopes) {
      if (owner !== '' && owner !== scope) continue;
      const existing = project.getSourceFile(toFsPath(path));
      if (text === undefined) {
        if (existing) project.removeSourceFile(existing);
      } else if (existing) {
        if (existing.getFullText() !== text) existing.replaceWithText(text);
      } else project.createSourceFile(toFsPath(path), text, { overwrite: true });
    }
  }

  private _context(path: string): AnalyzeContext {
    const file = this.project.getSourceFile(toFsPath(path));
    if (!file) throw new CodeError(`File not loaded: ${path}`, path);
    return {
      path,
      file,
      project: this.project,
      text: file.getFullText(),
      ref: (node) => {
        const kind = node.getKindName();
        return {
          id: `${path}:${kind}@${node.getStart()}`,
          path,
          kind,
          start: node.getStart(),
          end: node.getEnd(),
        };
      },
      resolve: (ref) => {
        const node = file.getDescendantAtPos(ref.start);
        for (let current: Node | undefined = node; current; current = current.getParent()) {
          if (current.getStart() === ref.start && current.getKindName() === ref.kind)
            return current;
          if (current.getStart() < ref.start) break;
        }
        return undefined;
      },
      literals: { literalToValue, valueToLiteral, readExportedLiteral, quoteStyle },
      moduleSpecifier: (targetPath, fromPath = path) =>
        moduleSpecifierFor(fromPath, targetPath, this._paths),
    };
  }

  private async _loadTypes(path: string): Promise<void> {
    const resolve = this._options.resolveTypes;
    const file = this.project.getSourceFile(toFsPath(path));
    if (!resolve || !file) return;
    const modules = new Set<string>();
    for (const declaration of file.getImportDeclarations())
      modules.add(declaration.getModuleSpecifierValue());
    for (const declaration of file.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (specifier) modules.add(specifier);
    }
    for (const module of modules) {
      if (module.startsWith('.') || module.startsWith('/') || module.startsWith('node:')) continue;
      if (Object.keys(this._paths).some((pattern) => matchesPathPattern(pattern, module))) continue;
      const packageName = module.startsWith('@')
        ? module.split('/').slice(0, 2).join('/')
        : module.split('/')[0]!;
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      let roots = this._typeRoots.get(packageName);
      if (!roots) this._typeRoots.set(packageName, (roots = { found: [], asked: new Set() }));
      const visible = roots.found.some(
        (root) => root === '' || dir === root || dir.startsWith(`${root}/`),
      );
      if (visible || roots.asked.has(dir)) continue;
      roots.asked.add(dir);
      try {
        const files = await resolve(packageName, path);
        const marker = files[0]?.path.indexOf('node_modules/') ?? -1;
        if (marker >= 0) {
          const root = files[0]!.path.slice(0, marker).replace(/\/$/, '');
          if (root && !this._scopeRoots().includes(root)) this._scopes = undefined;
          roots.found.push(root);
        }
        this.setFiles(files);
      } catch {}
    }
  }
}
