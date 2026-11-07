import type { PluginStatus } from './plugin-resolution.type';

export const describeStatus = (status: PluginStatus): string => {
  switch (status.kind) {
    case 'ok':
      return 'ok';
    case 'disabled':
      return 'disabled';
    case 'shadowed':
      return `shadowed by the ${status.by} version`;
    case 'incompatible-editor':
      return `requires editor ${status.required} (running ${status.actual})`;
    case 'incompatible-runtime':
      return `compiled with ${status.module} ${status.compiled}, editor provides ${status.actual}`;
    case 'missing-dependency':
      return `missing dependency ${status.dependency}@${status.range}`;
    case 'dependency-version':
      return `dependency ${status.dependency}@${status.actual} does not match ${status.range}`;
    case 'dependency-failed':
      return `dependency ${status.dependency} is not available`;
    case 'cycle':
      return `dependency cycle: ${status.cycle.join(' -> ')}`;
  }
};
