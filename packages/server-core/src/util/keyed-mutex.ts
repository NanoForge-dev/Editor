/** Serializes async work per key (git operations per project, writes per file…). */
export class KeyedMutex {
  private readonly _tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this._tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.catch(() => undefined);
    this._tails.set(key, tail);
    void tail.then(() => {
      if (this._tails.get(key) === tail) this._tails.delete(key);
    });
    return result;
  }
}
