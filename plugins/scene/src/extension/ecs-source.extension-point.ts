/**
 * The ECS plugin's `ecs.sources` extension point, as this plugin contributes to it (plugins
 * import only the SDK: the point is defined again with the same id).
 */
import { type AppModel, type Observable, defineExtensionPoint } from '@nanoforge-dev/editor-sdk';

export type EntryScope =
  | { readonly kind: 'main' }
  | { readonly kind: 'method'; readonly class: string; readonly method: string };

export interface EcsLocation {
  readonly path: string;
  readonly scope?: EntryScope;
  readonly label?: string;
  readonly scene?: string;
}

export interface InheritedLocation extends EcsLocation {
  readonly label: string;
}

export interface EcsSource {
  readonly id: string;
  readonly priority: number;
  readonly emptyMessage?: string;
  appliesTo(app: AppModel): boolean;
  current(app: AppModel): Observable<EcsLocation | undefined>;
  inherited(app: AppModel): Observable<readonly InheritedLocation[]>;
  edit?(app: AppModel, location: InheritedLocation): void;
  locationOf?(app: AppModel, scene: string): EcsLocation | undefined;
}

export const ECS_SOURCES = defineExtensionPoint<EcsSource>('ecs.sources');
