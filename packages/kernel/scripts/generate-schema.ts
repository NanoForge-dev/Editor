import { writeFileSync } from 'node:fs';

import { pluginManifestJsonSchema } from '../src/plugin/plugin-manifest';

const target = new URL('../schemas/plugin.schema.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(pluginManifestJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${target.pathname}`);
