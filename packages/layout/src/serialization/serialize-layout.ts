import { LAYOUT_VERSION } from '../model/layout.const';
import type { Layout } from '../model/layout.type';
import { repairLayout } from './repair-layout';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Migrations from version N to N + 1 (none yet: version 1 is the first). */
const MIGRATIONS: Record<number, Migration> = {};

export const serializeLayout = (layout: Layout): string => JSON.stringify(layout);

/**
 * Parses a stored layout: migrates old versions and repairs inconsistencies (duplicate
 * instances, dangling active tabs, invalid sizes). Widgets are kept even when their plugin is
 * not installed; the renderer shows them as placeholders. Returns undefined when unusable.
 */
export const deserializeLayout = (input: unknown): Layout | undefined => {
  let raw: unknown = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  let document = raw as Record<string, unknown>;
  let version = typeof document.version === 'number' ? document.version : 0;
  if (version > LAYOUT_VERSION || version < 1) return undefined;
  while (version < LAYOUT_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return undefined;
    document = migrate(document);
    version++;
  }
  return repairLayout(document);
};
