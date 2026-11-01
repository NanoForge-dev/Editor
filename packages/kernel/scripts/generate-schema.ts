import { writeFileSync } from 'node:fs';

import { pluginManifestJsonSchema } from '../src/plugin/plugin-manifest';
import { KIT_CONTRIBUTIONS } from './kit-contributions';

const target = new URL('../schemas/plugin.schema.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(pluginManifestJsonSchema(KIT_CONTRIBUTIONS), null, 2)}\n`);
console.log(`Wrote ${target.pathname}`);
