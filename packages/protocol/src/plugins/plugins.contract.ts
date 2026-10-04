import { z } from 'zod';

import { defineContract } from '@nanoforge-dev/editor-rpc';

import { PluginListing, PluginSuggestion } from './plugins.schema';

export const PluginsContract = defineContract('plugins', {
  methods: {
    /** Every plugin, plus the open project's own when `project` is set. */
    list: {
      input: z.object({ project: z.string().optional() }).nullable(),
      output: z.array(PluginListing),
    },
    suggestions: { input: z.object({ project: z.string() }), output: z.array(PluginSuggestion) },
  },
  streams: {
    /** Fired when a local dev plugin was rebuilt: the client hot reloads it. */
    devChanges: {
      params: z.null(),
      event: z.object({ name: z.string(), listing: PluginListing }),
    },
  },
});
