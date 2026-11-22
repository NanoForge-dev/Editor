/** The documentation site (the editor's pages are under `/docs/editor/`). */
export const DOCS_URL = 'https://docs.nanoforge.eu';

/** The URL of a page of the editor's documentation, given relative to its folder (`editor/entities`). */
export const docsPage = (page: string): string => `${DOCS_URL}/docs/editor/${page}`;
