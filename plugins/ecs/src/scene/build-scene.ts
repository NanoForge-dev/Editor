/**
 * The 2D scene of an app (spec: "Scene screen"), drawn from its entry file: each entity's
 * position (a component with numeric `x` and `y` params) and its graphics-2d shapes (`Rect`,
 * `Circle` arguments written as literals). While playing, positions come from the live world.
 */
import type { CatalogItem } from '@nanoforge-dev/editor-sdk';

import type { LiveEntity } from '../live/live.type';
import type { ArgModel, EntryModel } from '../model/ecs-model.type';

export interface ScenePosition {
  /** Index of the component in the entity (for `setArgs`). */
  readonly component: number;
  /** ECS name of the component (for live edits). */
  readonly componentName: string;
  readonly xParam: number;
  readonly yParam: number;
}

export interface SceneShape {
  /** The entity's variable. */
  readonly entity: string;
  readonly kind: 'rect' | 'circle';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly position?: ScenePosition;
}

const SHAPES: Record<string, 'rect' | 'circle'> = { Rect: 'rect', Circle: 'circle' };

const num = (value: unknown, fallback = 0) => (typeof value === 'number' ? value : fallback);
const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

const argNumber = (arg: ArgModel | undefined, fallback: unknown) =>
  num(arg?.value !== undefined ? arg.value : fallback);

/** The shapes of the entry file's entities. */
export const buildScene = (
  model: EntryModel | undefined,
  itemOf: (ref: string | undefined) => CatalogItem | undefined,
  ecsNameOf: (item: CatalogItem | undefined, className: string | undefined) => string,
): SceneShape[] => {
  const shapes: SceneShape[] = [];
  for (const entity of model?.entities ?? []) {
    let position: (ScenePosition & { x: number; y: number }) | undefined;
    let named = false;
    entity.components.forEach((use, index) => {
      if (named) return;
      const item = itemOf(use.item);
      const params = item?.meta.params ?? [];
      const xParam = params.findIndex((param) => param.name === 'x' && param.type === 'number');
      const yParam = params.findIndex((param) => param.name === 'y' && param.type === 'number');
      if (xParam < 0 || yParam < 0) return;
      const isNamed = /position|transform|location/i.test(ecsNameOf(item, use.className));
      if (position && !isNamed) return;
      named = isNamed;
      const defaults = params as readonly { default?: unknown }[];
      position = {
        component: index,
        componentName: ecsNameOf(item, use.className),
        xParam,
        yParam,
        x: argNumber(use.args[xParam], defaults[xParam]?.default),
        y: argNumber(use.args[yParam], defaults[yParam]?.default),
      };
    });
    for (const use of entity.components) {
      for (const arg of use.args) {
        const kind = arg.construct ? SHAPES[arg.construct.className] : undefined;
        if (!kind || !arg.construct) continue;
        const config = (arg.construct.args[0] ?? {}) as Record<string, unknown>;
        shapes.push({
          entity: entity.name,
          kind,
          x: (position?.x ?? 0) + num(config.x),
          y: (position?.y ?? 0) + num(config.y),
          width: num(config.width, 50),
          height: num(config.height, 50),
          radius: num(config.radius, 25),
          ...(str(config.fill) && { fill: str(config.fill) }),
          ...(str(config.stroke) && { stroke: str(config.stroke) }),
          ...(position && {
            position: {
              component: position.component,
              componentName: position.componentName,
              xParam: position.xParam,
              yParam: position.yParam,
            },
          }),
        });
      }
    }
  }
  return shapes;
};

/** The code shapes moved to their live positions (entities of the running game). */
export const withLivePositions = (
  shapes: readonly SceneShape[],
  entities: readonly LiveEntity[],
  /** The scene of the shapes: live entities of other scenes don't match. */
  scene?: string,
): SceneShape[] =>
  shapes.map((shape) => {
    const entity = entities.find(
      (candidate) => candidate.code === shape.entity && candidate.scene === scene,
    );
    const position = shape.position;
    const value = position
      ? entity?.components.find((component) => component.name === position.componentName)?.value
      : undefined;
    if (!value || typeof value.x !== 'number' || typeof value.y !== 'number') return shape;
    return { ...shape, x: value.x, y: value.y };
  });
