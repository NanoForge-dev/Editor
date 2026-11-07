export class PluginManifestError extends Error {
  constructor(
    readonly issues: readonly { path: string; message: string }[],
    readonly location?: string,
  ) {
    super(
      `Invalid plugin manifest${location ? ` (${location})` : ''}:\n` +
        issues.map((issue) => `  - ${issue.path || '<root>'}: ${issue.message}`).join('\n'),
    );
    this.name = 'PluginManifestError';
  }
}
