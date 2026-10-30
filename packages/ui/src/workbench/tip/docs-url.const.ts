/** The documentation site (the editor's pages are under `/docs/`). */
export const DOCS_URL = 'https://docs.nanoforge.eu';

/** The URL of a page of the editor's documentation (`editor/entities`). */
export const docsPage = (page: string): string => `${DOCS_URL}/docs/${page}`;
