import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { SessionInfo } from './session.schema';

export const SessionContract = defineContract('session', {
  methods: {
    info: { input: z.null(), output: SessionInfo, public: true },
  },
});
