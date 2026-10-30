import { writeFileSync } from 'node:fs';

import { envExample } from './env-example';

const file = new URL('../../../.env.example', import.meta.url);
writeFileSync(file, envExample());
console.log(`Wrote ${file.pathname}`);
