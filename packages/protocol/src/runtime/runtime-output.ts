/**
 * The app segment of a single-app project (app id `''`). Not `.`: browsers resolve `/./` away,
 * and the game's module URL then misses its app.
 */
const ROOT_APP = '-';

/** URL path of an app's build output (`app` is the app id, `''` for single-app projects). */
export const runtimeOutputPath = (project: string, app: string): string =>
  `/runtime/${project}/${encodeURIComponent(app || ROOT_APP)}/`;

/** Inverse of {@link runtimeOutputPath}'s app segment. */
export const decodeRuntimeApp = (segment: string): string => {
  const app = decodeURIComponent(segment);
  return app === ROOT_APP || app === '.' ? '' : app;
};
