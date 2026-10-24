/** Global base rules of the editor (injected in the `reset` layer). */
export const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--nf-color-bg);
  color: var(--nf-color-text);
  font: var(--nf-font-size-md) / var(--nf-line-height) var(--nf-font-ui);
  font-feature-settings: 'tnum' 1;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
:focus-visible { outline: 2px solid var(--nf-color-focus); outline-offset: -2px; }
::selection { background: var(--nf-color-selection); color: var(--nf-color-selection-text); }
button, input, select, textarea { font: inherit; color: inherit; }
code, kbd, pre { font-family: var(--nf-font-code); }
* { scrollbar-width: thin; scrollbar-color: var(--nf-color-border-strong) transparent; }
[hidden] { display: none !important; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
`;
