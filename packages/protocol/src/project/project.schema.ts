import { z } from 'zod';

import { ProjectPath } from '../path/project-path';

export const ProjectId = z.string().regex(/^[\w-]{6,64}$/);
export type ProjectId = z.output<typeof ProjectId>;

export const AppType = z.enum(['client', 'server', 'lib']);

/** An app (client, server) or shared lib of a game workspace. */
export const AppModel = z.object({
  /** Path of the app relative to the project root ('' for single-app projects). */
  id: z.string(),
  name: z.string(),
  type: AppType,
  root: ProjectPath,
  language: z.enum(['ts', 'js']),
  /** Paths relative to the project root. */
  dirs: z.object({
    assets: ProjectPath,
    components: ProjectPath,
    systems: ProjectPath,
    scenes: ProjectPath,
  }),
  entryFile: ProjectPath.optional(),
  editorEntryFile: ProjectPath.optional(),
  outDir: ProjectPath.optional(),
  /** Engine libraries (`@nanoforge-dev/*` runtime packages) and their version or range. */
  engineLibs: z.record(z.string(), z.string()),
  /**
   * The shared libraries (ADR 0004) the app uses, by package name: those its `nanoforge.config`
   * lists in `libs` (a library: those its package.json depends on). A library nothing mentions is
   * given to every app.
   */
  libraries: z.array(z.string()).default([]),
  /** A shared library nothing mentions (`libs`, package.json): every app gets it (see `libraries`). */
  unclaimed: z.boolean().optional(),
});
export type AppModel = z.output<typeof AppModel>;

export const ProjectDiagnostic = z.object({
  path: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
});

export const ProjectModel = z.object({
  id: ProjectId,
  name: z.string(),
  /** Display location: absolute path (offline) or gateway name (online). */
  location: z.string(),
  apps: z.array(AppModel),
  diagnostics: z.array(ProjectDiagnostic),
});
export type ProjectModel = z.output<typeof ProjectModel>;

export const ProjectRef = z.union([
  z.object({ path: z.string().min(1) }),
  z.object({ gatewayId: z.string().min(1) }),
]);
export type ProjectRef = z.output<typeof ProjectRef>;

export const RecentProject = z.object({
  id: ProjectId,
  name: z.string(),
  location: z.string(),
  ref: ProjectRef,
  openedAt: z.date(),
});
export type RecentProject = z.output<typeof RecentProject>;
