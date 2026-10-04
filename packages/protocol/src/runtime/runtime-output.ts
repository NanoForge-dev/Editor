/** URL path of an app's build output (`app` is the app id, `''` for single-app projects). */
export const runtimeOutputPath = (project: string, app: string): string =>
  `/runtime/${project}/${encodeURIComponent(app || '.')}/`;

/** Inverse of {@link runtimeOutputPath}'s app segment. */
export const decodeRuntimeApp = (segment: string): string => {
  const app = decodeURIComponent(segment);
  return app === '.' ? '' : app;
};
