export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid editor environment:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvError';
  }
}
