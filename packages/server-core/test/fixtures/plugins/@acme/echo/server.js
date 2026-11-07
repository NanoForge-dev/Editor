import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

export const EchoContract = defineContract('plugin.@acme/echo', {
  methods: { echo: { input: z.object({ text: z.string() }), output: z.string() } },
});

export default {
  activate(context) {
    context.implement(EchoContract, {
      methods: { echo: ({ text }, { session }) => `${text} from ${session.user.name}` },
    });
  },
};
