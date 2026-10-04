import semver from 'semver';

import type {
  PluginDescriptor,
  PluginStatus,
  Resolution,
  ResolveOptions,
  ResolvedPlugin,
} from './plugin-resolution.type';
import { PLUGIN_SOURCE_ORDER } from './plugin-source.enum';

const satisfies = (version: string, range: string) =>
  semver.satisfies(version, range, { includePrerelease: true });

/**
 * A compiled Svelte component calls runtime internals: it must have been compiled with the same
 * major and a version not newer than the host runtime (docs/adr/0001-plugin-ui-runtime.md).
 */
const runtimeCompatible = (compiled: string, actual: string) =>
  semver.major(compiled) === semver.major(actual) && semver.lte(compiled, actual);

const optionalOk = (plugins: Map<string, ResolvedPlugin>, name: string, range: string) => {
  const dependency = plugins.get(name);
  return (
    dependency?.status.kind === 'ok' && satisfies(dependency.descriptor.manifest.version, range)
  );
};

export const resolvePlugins = (
  descriptors: readonly PluginDescriptor[],
  options: ResolveOptions,
): Resolution => {
  const candidates = new Map<string, PluginDescriptor>();
  const shadowed: ResolvedPlugin[] = [];
  const rank = (d: PluginDescriptor) => PLUGIN_SOURCE_ORDER.indexOf(d.source);
  for (const descriptor of [...descriptors].sort((a, b) => rank(a) - rank(b))) {
    const previous = candidates.get(descriptor.manifest.name);
    if (previous) {
      shadowed.push({ descriptor: previous, status: { kind: 'shadowed', by: descriptor.source } });
    }
    candidates.set(descriptor.manifest.name, descriptor);
  }

  const plugins = new Map<string, ResolvedPlugin>();
  for (const [name, descriptor] of candidates) {
    plugins.set(name, { descriptor, status: checkPlugin(descriptor, candidates, options) });
  }

  for (const cycle of findCycles(plugins)) {
    for (const name of cycle) {
      plugins.set(name, {
        descriptor: plugins.get(name)!.descriptor,
        status: { kind: 'cycle', cycle },
      });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, plugin] of plugins) {
      if (plugin.status.kind !== 'ok') continue;
      const failed = Object.keys(plugin.descriptor.manifest.dependencies).find(
        (dependency) => plugins.get(dependency)?.status.kind !== 'ok',
      );
      if (failed) {
        plugins.set(name, {
          descriptor: plugin.descriptor,
          status: { kind: 'dependency-failed', dependency: failed },
        });
        changed = true;
      }
    }
  }

  return { plugins, shadowed, order: activationOrder(plugins) };
};

const checkPlugin = (
  descriptor: PluginDescriptor,
  candidates: ReadonlyMap<string, PluginDescriptor>,
  options: ResolveOptions,
): PluginStatus => {
  const { manifest } = descriptor;
  if (options.disabled?.has(manifest.name)) return { kind: 'disabled' };
  if (!satisfies(options.editorVersion, manifest.engines.editor)) {
    return {
      kind: 'incompatible-editor',
      required: manifest.engines.editor,
      actual: options.editorVersion,
    };
  }
  for (const [module, compiled] of Object.entries(manifest.build)) {
    const actual = options.runtimeVersions?.[module];
    if (compiled && actual && !runtimeCompatible(compiled, actual)) {
      return { kind: 'incompatible-runtime', module, compiled, actual };
    }
  }
  for (const [dependency, range] of Object.entries(manifest.dependencies)) {
    const found = candidates.get(dependency);
    if (!found) return { kind: 'missing-dependency', dependency, range };
    if (!satisfies(found.manifest.version, range)) {
      return { kind: 'dependency-version', dependency, range, actual: found.manifest.version };
    }
  }
  return { kind: 'ok' };
};

/** Edges used for ordering: required dependencies and valid optional ones. */
const edges = (plugins: Map<string, ResolvedPlugin>, plugin: ResolvedPlugin): string[] => {
  const { dependencies, optionalDependencies } = plugin.descriptor.manifest;
  return [
    ...Object.keys(dependencies).filter((name) => plugins.has(name)),
    ...Object.entries(optionalDependencies)
      .filter(([name, range]) => optionalOk(plugins, name, range))
      .map(([name]) => name),
  ];
};

/** Strongly connected components with more than one node (or a self loop), via Tarjan. */
const findCycles = (plugins: Map<string, ResolvedPlugin>): string[][] => {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  let counter = 0;

  const visit = (name: string) => {
    index.set(name, counter);
    low.set(name, counter++);
    stack.push(name);
    onStack.add(name);
    for (const next of edges(plugins, plugins.get(name)!)) {
      if (plugins.get(next)?.status.kind !== 'ok') continue;
      if (!index.has(next)) {
        visit(next);
        low.set(name, Math.min(low.get(name)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(name, Math.min(low.get(name)!, index.get(next)!));
      }
    }
    if (low.get(name) !== index.get(name)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== name);
    const selfLoop = edges(plugins, plugins.get(name)!).includes(name);
    if (component.length > 1 || selfLoop) cycles.push(component.sort());
  };

  for (const [name, plugin] of [...plugins].sort(([a], [b]) => a.localeCompare(b))) {
    if (plugin.status.kind === 'ok' && !index.has(name)) visit(name);
  }
  return cycles;
};

/** Kahn's algorithm over ok plugins; ties broken by name for a deterministic order. */
const activationOrder = (plugins: Map<string, ResolvedPlugin>): PluginDescriptor[] => {
  const ok = [...plugins].filter(([, plugin]) => plugin.status.kind === 'ok');
  const pending = new Map(ok.map(([name, plugin]) => [name, new Set(edges(plugins, plugin))]));
  const order: PluginDescriptor[] = [];
  while (pending.size) {
    const ready = [...pending]
      .filter(([, deps]) => [...deps].every((dep) => !pending.has(dep)))
      .map(([name]) => name)
      .sort();
    if (!ready.length) break; // unreachable: cycles were removed
    for (const name of ready) {
      pending.delete(name);
      order.push(plugins.get(name)!.descriptor);
    }
  }
  return order;
};
