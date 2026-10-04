import { type Node, Node as NodeGuards, type SourceFile } from 'ts-morph';

import {
  docOf,
  exampleText,
  firstTag,
  hasTag,
  oneParagraph,
  paramTexts,
  tagTexts,
} from '../doc/doc-comment';
import type { ItemOwner, OwnerContext, OwnerInput } from '../owner/item-owner.type';
import type { Element, ParamGroup } from '../schema/element.schema';
import type { Side } from '../schema/item-ref.schema';
import type { ItemMeta } from '../schema/meta-file.schema';
import { elementOfType } from '../type/element-of-type';
import type { TypeContext } from '../type/type-context.type';
import {
  constructorOf,
  docNodeOf,
  exportedDeclarations,
  parametersOf,
  tagsByName,
} from './exported-declarations';
import type { ExtractOptions, ExtractResult, MetaDiagnostic } from './extract.type';
import { CORE_TAGS, SIDES, STANDARD_TAGS } from './meta-tags.const';
import {
  asAsset,
  assetTags,
  fieldsSetFromConstructor,
  isPublicInstanceField,
  withDefault,
} from './param-fields';
import { layoutOf, parseGroupDeclaration } from './param-layout';
import { requiresOf } from './requires';

/**
 * Extracts the items of one file: core fields from TSDoc and TypeScript, and each owner's object.
 * An export is an item when the file is `listed`, when an owner claims it (tags or inference), or
 * when it carries tags of an owner that isn't installed (kept in `unclaimedTags`).
 */
export const extractItems = (file: SourceFile, options: ExtractOptions): ExtractResult => {
  const diagnostics: MetaDiagnostic[] = [];
  const typeContext: TypeContext = { modulePath: options.modulePath };
  const context: OwnerContext = {
    file,
    path: options.path,
    source: options.source,
    ...(options.folder && { folder: options.folder }),
    refOf: options.refOf,
  };
  const ownedTags = new Map<string, ItemOwner>();
  for (const owner of options.owners) for (const tag of owner.tags) ownedTags.set(tag, owner);
  const warn = (node: Node, message: string, source = 'meta') =>
    diagnostics.push({
      path: options.path,
      start: node.getStart(),
      length: node.getWidth(),
      message,
      severity: 'warning',
      source,
    });
  const requires = requiresOf(file);
  const items: ItemMeta[] = [];

  for (const { exportName, declaration, kind } of exportedDeclarations(file)) {
    const doc = docOf(docNodeOf(declaration));
    if (hasTag(doc, 'internal')) continue;
    const tags = tagsByName(doc);
    const nameNode = declaration.getNameNode() ?? declaration;

    const ownerObjects: Record<string, Record<string, unknown>> = {};
    const claimedParams = new Set<string>();
    const claimedFields = new Set<string>();
    for (const owner of options.owners) {
      const own: Record<string, string[]> = {};
      for (const tag of owner.tags) if (tags[tag]) own[tag] = tags[tag];
      const input: OwnerInput = { declaration, kind, tags: own, context };
      if (!Object.keys(own).length && !owner.infer?.(input)) continue;
      let value: Record<string, unknown> | undefined;
      try {
        value = owner.extract(input);
      } catch (error) {
        warn(nameNode, `${owner.name} could not read ${exportName}: ${String(error)}`, owner.name);
        continue;
      }
      if (!value) continue;
      const check = owner.validate?.safeParse(value);
      if (check && !check.success) {
        warn(nameNode, `${owner.name} wrote an invalid description of ${exportName}`, owner.name);
        continue;
      }
      ownerObjects[owner.name] = value;
      const claims = owner.claims?.(input);
      for (const name of claims?.params ?? []) claimedParams.add(name);
      for (const name of claims?.fields ?? []) claimedFields.add(name);
    }

    const unclaimed: Record<string, string[]> = {};
    for (const [name, texts] of Object.entries(tags)) {
      if (CORE_TAGS.has(name) || STANDARD_TAGS.has(name) || ownedTags.has(name)) continue;
      unclaimed[name] = texts;
    }

    const isItem =
      options.listed || Object.keys(ownerObjects).length > 0 || Object.keys(unclaimed).length > 0;
    if (!isItem) continue;

    let side: Side = 'shared';
    const sideText = firstTag(doc, 'side');
    if (sideText !== undefined) {
      const value = sideText.split(/\s+/)[0] ?? '';
      if (SIDES.has(value)) side = value as Side;
      else warn(nameNode, `@side must be client, server or shared, not "${value}"`);
    }

    const ownerDoc = NodeGuards.isClassDeclaration(declaration)
      ? docOf(constructorOf(declaration))
      : doc;
    const paramDocs = paramTexts(ownerDoc);
    const constructorAssets = assetTags(ownerDoc, false);
    const params: Element[] = [];
    for (const param of parametersOf(declaration)) {
      const name = param.getName();
      if (claimedParams.has(name)) continue;
      const own = docOf(param);
      let element = elementOfType(name, param.getType(), param, typeContext);
      element = withDefault(element, param.getInitializer());
      const assets = constructorAssets.get(name) ?? assetTags(own, true).get('');
      if (assets) element = asAsset(element, assets);
      const description = oneParagraph(own.description) || paramDocs.get(name);
      const layout = layoutOf(own);
      const deprecated = firstTag(own, 'deprecated');
      params.push({
        ...element,
        ...((param.isOptional() || param.hasInitializer()) && { optional: true }),
        ...(description && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(layout && { layout }),
      } as Element);
    }

    const fields: Element[] = [];
    if (NodeGuards.isClassDeclaration(declaration)) {
      const fromConstructor = fieldsSetFromConstructor(declaration);
      for (const property of declaration.getProperties()) {
        const name = property.getName();
        if (!isPublicInstanceField(property) || claimedFields.has(name)) continue;
        if (fromConstructor.has(name)) continue;
        const own = docOf(property);
        if (hasTag(own, 'internal')) continue;
        let element = elementOfType(name, property.getType(), property, typeContext);
        element = withDefault(element, property.getInitializer());
        const assets = assetTags(own, true).get('');
        if (assets) element = asAsset(element, assets);
        const description = oneParagraph(own.description);
        const layout = layoutOf(own);
        fields.push({
          ...element,
          ...(property.hasQuestionToken() && { optional: true }),
          ...(description && { description }),
          ...(layout && { layout }),
        } as Element);
      }
    }

    const groups: ParamGroup[] = [];
    for (const text of tags.group ?? []) {
      const group = parseGroupDeclaration(text);
      if (!group) warn(nameNode, `@group needs a name: "@group Coords - description"`);
      else if (groups.some((existing) => existing.name === group.name))
        warn(nameNode, `The group "${group.name}" is declared twice`);
      else groups.push(group);
    }
    for (const element of [...params, ...fields]) {
      const name = element.layout?.group;
      if (name && !groups.some((group) => group.name === name)) groups.push({ name });
    }

    const description = oneParagraph(
      [doc.description, ...tagTexts(doc, 'remarks')].filter(Boolean).join('\n\n'),
    );
    const example = firstTag(doc, 'example');
    const deprecated = firstTag(doc, 'deprecated');
    items.push({
      export: exportName,
      source: options.path,
      kind,
      side,
      ...(description && { description }),
      ...(example && { example: exampleText(example) }),
      ...(deprecated !== undefined && { deprecated }),
      params,
      fields,
      groups,
      requires,
      ...(Object.keys(unclaimed).length && { unclaimedTags: unclaimed }),
      ...ownerObjects,
    } as ItemMeta);
  }
  return { items, diagnostics };
};
