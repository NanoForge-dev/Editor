import ts, { type Expression, type ObjectLiteralElementLike } from 'typescript';

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

const parseManifest = (title: string, source: ts.SourceFile): any | null => {
  return getManifestFromNode(findManifestNode(title, source));
};

export const resolveManifest = (type: 'component' | 'system', content: string): any | null => {
  const source = ts.createSourceFile('tmp.ts', content, ts.ScriptTarget.ESNext, true);
  return parseManifest(
    type === 'component' ? 'EDITOR_COMPONENT_MANIFEST' : 'EDITOR_SYSTEM_MANIFEST',
    source,
  );
};
