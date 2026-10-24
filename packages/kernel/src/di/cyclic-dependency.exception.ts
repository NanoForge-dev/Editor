export class CyclicDependencyError extends Error {
  constructor(readonly path: string[]) {
    super(`Cyclic service dependency: ${path.join(' -> ')}`);
    this.name = 'CyclicDependencyError';
  }
}
