#!/usr/bin/env node
const { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const args = process.argv.slice(2);
const dir = resolve(args[args.indexOf('--directory') + 1]);
const source = readFileSync(join(dir, 'game.js'), 'utf8');
if (source.includes('SYNTAX ERROR')) {
  console.log('- Building');
  console.error('error: Unexpected ;');
  console.error('    at ' + join(dir, 'game.js') + ':3:11');
  console.error('Build failed!');
  process.exit(1);
}
rmSync(join(dir, 'dist'), { recursive: true, force: true });
mkdirSync(join(dir, 'dist'), { recursive: true });
writeFileSync(join(dir, 'dist', 'main.js'), source);
writeFileSync(join(dir, 'dist', 'data.txt'), 'data');
console.log('Build succeeded!');
