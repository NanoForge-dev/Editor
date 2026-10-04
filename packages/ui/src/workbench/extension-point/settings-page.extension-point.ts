import type { Component } from 'svelte';

import {
  type ExtensionPoint,
  type Observable,
  type ServiceAccessor,
  defineExtensionPoint,
} from '@nanoforge-dev/editor-kernel';
import type { WritableScope } from '@nanoforge-dev/editor-settings';

/** What a page of the Settings dialog gets: the dialog's pending changes, written on Apply. */
export interface SettingsPageApi {
  /** Bumped when pending changes or stored settings change. */
  readonly revision: Observable<number>;
  /**
   * The value of a setting with its pending change. For a setting merged across scopes
   * (`union`, `deep`), read each scope with `scopeValue` instead.
   */
  value(key: string): unknown;
  /** What one scope holds for a setting (pending change included); undefined when not set there. */
  scopeValue(key: string, scope: WritableScope): unknown;
  /** Sets the value of a setting in a scope. A setting has one pending change at a time. */
  set(key: string, value: unknown, scope: WritableScope): void;
  /** Whether a setting has a pending change. */
  isPending(key: string): boolean;
}

/**
 * A page of the Settings dialog with its own editor (keyboard shortcuts…), listed after the
 * setting categories.
 */
export interface SettingsPage {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly order?: number;
  /** Settings the page edits: they leave the category tree and the search. */
  readonly settings?: readonly string[];
  readonly component: Component<{ services: ServiceAccessor; page: SettingsPageApi }>;
}

export const SETTINGS_PAGES: ExtensionPoint<SettingsPage> =
  defineExtensionPoint<SettingsPage>('ui.settingsPages');
