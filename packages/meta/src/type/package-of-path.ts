const NODE_MODULES = '/node_modules/';

/** A package name from a path inside `node_modules`, else undefined. */
export const packageOfPath = (path: string): string | undefined => {
  const index = path.lastIndexOf(NODE_MODULES);
  if (index < 0) return undefined;
  const [first, second] = path.slice(index + NODE_MODULES.length).split('/');
  if (!first) return undefined;
  const name = first.startsWith('@') ? `${first}/${second ?? ''}` : first;
  return name.startsWith('@types/') ? name.slice('@types/'.length).replace('__', '/') : name;
};
