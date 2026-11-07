import { firstTag, hasTag, oneParagraph } from '../doc/doc-comment';
import type { Doc } from '../doc/doc.type';
import type { ElementLayout, ParamGroup } from '../schema/element.schema';

/** `@group Name [color=<css>] [hidden] - description` of a header. */
export const parseGroupDeclaration = (text: string): ParamGroup | undefined => {
  const separator = text.search(/\s-\s|\s-$/);
  const head = (separator < 0 ? text : text.slice(0, separator)).trim();
  const description =
    separator < 0 ? '' : oneParagraph(text.slice(separator).replace(/^\s-\s?/, ''));
  const words = head.split(/\s+/).filter(Boolean);
  let color: string | undefined;
  let hidden = false;
  while (words.length > 1) {
    const last = words.at(-1)!;
    if (last === 'hidden') hidden = true;
    else if (last.startsWith('color=')) color = last.slice('color='.length);
    else break;
    words.pop();
  }
  const name = words.join(' ');
  if (!name) return undefined;
  return {
    name,
    ...(description && { description }),
    ...(color && { color }),
    ...(hidden && { hidden }),
  };
};

/** Layout of a param or field from its own doc. */
export const layoutOf = (doc: Doc): ElementLayout | undefined => {
  const layout: ElementLayout = {};
  const label = firstTag(doc, 'label');
  if (label) layout.label = label;
  const group = firstTag(doc, 'group');
  if (group) layout.group = group;
  const preset = firstTag(doc, 'preset');
  if (preset) {
    const [id, slot] = preset.split(/\s+/)[0]!.split('.');
    if (id) layout.preset = { id, ...(slot && { slot }) };
  }
  const color = firstTag(doc, 'color');
  if (color) layout.color = color.split(/\s+/)[0]!;
  if (hasTag(doc, 'hidden')) layout.hidden = true;
  return Object.keys(layout).length ? layout : undefined;
};
