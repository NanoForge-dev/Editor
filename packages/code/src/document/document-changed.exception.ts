export class DocumentChangedError extends Error {
  constructor(readonly uri: string) {
    super(`${uri} changed since this edit`);
    this.name = 'DocumentChangedError';
  }
}
