const toWords = (str: string): string[] => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

export const toKebabCase = (str: string): string => {
  return toWords(str)
    .map((word) => word.toLowerCase())
    .join('-');
};

export const toPascalCase = (str: string): string => {
  return toWords(str)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export const toCamelCase = (str: string): string => {
  const words = toWords(str);
  return words
    .map((word, i) =>
      i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
};

export const camelToKebab = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
