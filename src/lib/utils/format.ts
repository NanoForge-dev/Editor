class WordList {
  words: string[];

  constructor(words: string[]) {
    this.words = words;
  }

  toKebab() {
    return this.words.join('-');
  }

  toPascal() {
    return this.words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }

  toCamel() {
    return this.words
      .map((word, i) =>
        i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join('');
  }
}

const toWords = (str: string): string[] => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

const fromKebab = (str: string): WordList => new WordList(str.split('-'));

const fromPascal = (str: string): WordList =>
  new WordList(str.split(/(?=[A-Z])/).map((word) => word.toLowerCase()));

const fromCamel = (str: string): WordList =>
  new WordList(str.split(/(?=[A-Z])/).map((word) => word.toLowerCase()));

const fromSnake = (str: string): WordList => new WordList(str.split('_'));

const fromAll = (str: string): WordList =>
  new WordList(toWords(str).map((word) => word.toLowerCase()));

export const formatFrom = {
  kebab: fromKebab,
  pascal: fromPascal,
  camel: fromCamel,
  snake: fromSnake,
  all: fromAll,
};
