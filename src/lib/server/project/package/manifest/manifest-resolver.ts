import ts, { type Expression, type ObjectLiteralElementLike } from 'typescript';

import { PackageTypeEnum } from '../package.enum';
import type { ManifestPackage } from '../package.type';

export const MANIFEST_TITLES = {
  [PackageTypeEnum.COMPONENT]: 'EDITOR_COMPONENT_MANIFEST',
  [PackageTypeEnum.SYSTEM]: 'EDITOR_SYSTEM_MANIFEST',
} as const;

const findManifestNode = (title: string, source: ts.SourceFile): ts.VariableDeclaration | null => {
  let res = null;
  source.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    node.declarationList.declarations.forEach((decl) => {
      if (!ts.isVariableDeclaration(decl)) return;
      if (decl.name.getText() === title) res = decl;
    });
  });
  return res;
};

const getName = (source: ts.SourceFile): string | null => {
  let res = null;
  source.forEachChild((node) => {
    if (!ts.isExportAssignment(node)) return;
    if (
      !node.getChildren().some((n) => n.getText() === 'export') ||
      !node.getChildren().some((n) => n.getText() === 'default')
    )
      return;
    res = node.expression.getFirstToken()?.getText();
  });
  return res;
};

const parseProperty = (prop: ObjectLiteralElementLike): any => {
  if (!ts.isPropertyAssignment(prop)) return {};

  const name = prop.name.getText();
  const value = prop.initializer;
  if (!value) return {};

  return { [name]: parseElement(value) };
};

const parseElement = (value: Expression): any => {
  if (ts.isStringLiteral(value)) return value.text;
  if (ts.isNumericLiteral(value)) return Number(value.text);
  if (ts.isLiteralTypeLiteral(value)) {
    const txt = value.getText();
    if (txt === 'true') return true;
    if (txt === 'false') return false;
    if (txt === 'null') return null;
    if (txt === 'undefined') return undefined;
  }
  if (ts.isArrayLiteralExpression(value)) return value.elements.map((el) => parseElement(el));
  if (ts.isObjectLiteralExpression(value))
    return value.properties.reduce((acc, prop) => {
      return { ...acc, ...parseProperty(prop) };
    }, {});
  throw new Error('Unknown element type');
};

const getManifestFromNode = (source: ts.VariableDeclaration | null): any | null => {
  if (!source) return null;

  const init = source.initializer;
  if (!init) return null;
  if (!ts.isObjectLiteralExpression(init)) return null;

  return parseElement(init);
};

const parseManifest = (type: ManifestPackage, source: ts.SourceFile): any | null => {
  const id = getName(source);
  const manifest = getManifestFromNode(findManifestNode(MANIFEST_TITLES[type], source));
  if (!id || !manifest) return null;
  return { id, type, ...manifest };
};

export const resolveManifest = (type: ManifestPackage, content: string): any | null => {
  const source = ts.createSourceFile('tmp.ts', content, ts.ScriptTarget.ESNext, true);
  return parseManifest(type, source);
};
