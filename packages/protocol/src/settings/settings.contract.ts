import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { ProjectId } from '../project/project.schema';
import { AccountSettingsDocument, SettingValues } from './settings.schema';

export const SettingsContract = defineContract('settings', {
  methods: {
    accountGet: { input: z.null(), output: AccountSettingsDocument },
    /** Fails with CONFLICT (data: the current document) when `baseRevision` is outdated. */
    accountPut: {
      input: z.object({ baseRevision: z.string().nullable(), values: SettingValues }),
      output: z.object({ revision: z.string() }),
    },
    /** Hosted editors only: this user's settings for a project (local ones use a file). */
    projectLocalGet: { input: z.object({ project: ProjectId }), output: SettingValues },
    projectLocalPut: {
      input: z.object({ project: ProjectId, values: SettingValues }),
      output: z.null(),
    },
  },
  streams: {
    /** The account document changed (another tab or device): pull it. */
    accountChanges: { params: z.null(), event: z.object({ revision: z.string() }), coalesce: true },
  },
});
