/**
 * The plugin has no code: its build copies the manifest and the icons into dist/, the folder the
 * editor loads a dev plugin from.
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
cpSync('nanoforge.manifest.json', 'dist/nanoforge.manifest.json');
cpSync('icons', 'dist/icons', { recursive: true });
