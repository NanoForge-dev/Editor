import { type ExtensionPoint, defineExtensionPoint } from '@nanoforge-dev/editor-kernel';

import type { ProjectCheck } from './project-check.type';

/** Checks behind the Project screen's "Adapt to the editor" report. */
export const PROJECT_CHECKS: ExtensionPoint<ProjectCheck> = defineExtensionPoint('project.checks');
