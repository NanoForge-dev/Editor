import {
  type CatalogItem,
  type CodeDiagnostic,
  DiagnosticsServiceToken,
  type Disposable,
  type PluginContext,
  observe,
} from '@nanoforge-dev/editor-sdk';

import { codeServices } from '../service/code-services';
import { ecsData } from '../service/ecs-data';
import type { EcsService } from '../service/ecs-service';
import { BUILT_IN_PRESETS, type PresetDefinition, buildLayout } from './param-layout';

const SOURCE = '@nanoforge/ecs';
const DELAY_MS = 300;

/** Where a declaration of an export starts in a file's text (`export class Position`). */
export const declarationOffset = (
  text: string,
  name: string,
): { start: number; length: number } | undefined => {
  const plain = name.replace(/[^\w]/g, '');
  const found = new RegExp(
    `^[ \\t]*export\\s+(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:class|function\\*?|const|let|var)\\s+(${plain})\\b`,
    'm',
  ).exec(text);
  if (!found?.[1]) return undefined;
  return { start: found.index + found[0].length - found[1].length, length: found[1].length };
};

/** The layout warnings of the components the project can edit (an incomplete preset…). */
export const layoutWarnings = (
  items: readonly CatalogItem[],
  presets: readonly PresetDefinition[],
): { item: CatalogItem; warnings: readonly string[] }[] =>
  items
    .filter((item) => !item.readonly && ecsData(item)?.type === 'component')
    .map((item) => ({
      item,
      warnings: buildLayout(
        [...item.meta.params, ...item.meta.fields],
        item.meta.groups,
        new Set(),
        [...presets, ...BUILT_IN_PRESETS],
      ).warnings,
    }))
    .filter((entry) => entry.warnings.length > 0);

/**
 * Shows the layout warnings of components in the code and in Problems, at the component's
 * declaration (the Component panel shows them too).
 */
export const followLayoutDiagnostics = (context: PluginContext, ecs: EcsService): Disposable => {
  const diagnostics = context.services.tryGet(DiagnosticsServiceToken);
  if (!diagnostics) return { dispose: () => undefined };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const update = async () => {
    const current = ++generation;
    const documents = codeServices(context).documents;
    const byPath = new Map<string, CodeDiagnostic[]>(
      diagnostics.uris(SOURCE).map((path) => [path, []]),
    );
    for (const { item, warnings } of layoutWarnings(
      ecs.catalogState.get()?.items ?? [],
      ecs.paramPresets.get(),
    )) {
      const path = item.meta.source;
      const text = await documents?.getText(path).catch(() => undefined);
      const at = text === undefined ? undefined : declarationOffset(text, item.meta.export);
      const list = byPath.get(path) ?? [];
      for (const warning of warnings)
        list.push({
          path,
          start: at?.start ?? 0,
          length: at?.length ?? 0,
          message: `${item.meta.export}: ${warning}`,
          severity: 'warning',
          source: SOURCE,
        });
      byPath.set(path, list);
    }
    if (current === generation) diagnostics.setMany(SOURCE, byPath);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void update(), DELAY_MS);
  };
  const subscriptions = [observe(ecs.catalogState, schedule), observe(ecs.paramPresets, schedule)];
  return {
    dispose: () => {
      clearTimeout(timer);
      generation++;
      for (const subscription of subscriptions) subscription.dispose();
      diagnostics.clear(SOURCE);
    },
  };
};
