/**
 * Styles of portaled UI kit parts (menus, popovers, dialogs, tooltips): they render outside of
 * their component, so they cannot use scoped styles. Injected in the `ui` layer.
 */
export const KIT_CSS = `
.nf-popover {
  z-index: var(--nf-z-menu);
  min-width: 180px;
  max-height: min(420px, var(--bits-select-content-available-height, 420px));
  overflow: auto;
  padding: var(--nf-space-1);
  border: 1px solid var(--nf-color-border-strong);
  border-radius: var(--nf-radius-float);
  background: var(--nf-color-raised);
  box-shadow: var(--nf-shadow-float);
  outline: none;
}
.nf-menu-item {
  display: flex;
  align-items: center;
  gap: var(--nf-space-2);
  height: var(--nf-row-height);
  padding: 0 var(--nf-space-2);
  border-radius: 2px;
  cursor: default;
  user-select: none;
  outline: none;
}
.nf-menu-item[data-highlighted] { background: var(--nf-color-selection); color: var(--nf-color-selection-text); }
.nf-menu-item[data-disabled] { opacity: 0.45; }
.nf-menu-check { display: inline-grid; place-items: center; width: 14px; flex: none; color: var(--nf-color-text-muted); }
.nf-menu-label { flex: 1; white-space: nowrap; }
.nf-menu-shortcut, .nf-menu-detail { color: var(--nf-color-text-faint); font: inherit; font-size: var(--nf-font-size-sm); }
.nf-menu-separator { height: 1px; margin: var(--nf-space-1) calc(-1 * var(--nf-space-1)); background: var(--nf-color-border); }
.nf-menu-empty { margin: 0; padding: var(--nf-space-2); color: var(--nf-color-text-muted); }
.nf-select-trigger, .nf-combobox {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--nf-control-height);
  border: 1px solid var(--nf-color-border);
  border-radius: var(--nf-radius-control);
  background: var(--nf-color-sunken);
}
.nf-select-trigger { justify-content: space-between; gap: var(--nf-space-2); padding: 0 var(--nf-space-2); cursor: pointer; }
.nf-select-trigger:hover, .nf-combobox:hover { border-color: var(--nf-color-border-strong); }
.nf-select-trigger:focus-visible, .nf-combobox:focus-within { border-color: var(--nf-color-focus); outline: none; }
.nf-combobox-input { flex: 1; min-width: 0; height: 100%; padding: 0 var(--nf-space-2); border: 0; background: transparent; outline: none; }
.nf-combobox-trigger { display: grid; place-items: center; width: var(--nf-control-height); height: 100%; border: 0; background: transparent; color: var(--nf-color-text-muted); cursor: pointer; }
.nf-tooltip {
  z-index: var(--nf-z-menu);
  max-width: 280px;
  padding: 3px var(--nf-space-2);
  border-radius: var(--nf-radius-control);
  background: var(--nf-color-text);
  color: var(--nf-color-bg);
  font-size: var(--nf-font-size-sm);
}
.nf-dialog-overlay { position: fixed; inset: 0; z-index: var(--nf-z-dialog); background: var(--nf-color-scrim); }
.nf-dialog {
  position: fixed;
  top: 18vh;
  left: 50%;
  z-index: var(--nf-z-dialog);
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  gap: var(--nf-space-3);
  max-height: 70vh;
  padding: var(--nf-space-4);
  border: 1px solid var(--nf-color-border-strong);
  border-radius: var(--nf-radius-float);
  background: var(--nf-color-raised);
  box-shadow: var(--nf-shadow-float);
  outline: none;
}
.nf-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: var(--nf-space-3); }
.nf-dialog-title { margin: 0; font-size: var(--nf-font-size-lg); font-weight: 600; }
.nf-dialog-description { margin: 0; color: var(--nf-color-text-muted); }
.nf-dialog-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
.nf-dialog-footer { display: flex; justify-content: flex-end; gap: var(--nf-space-2); }
.nf-context-area { display: contents; }
`;
