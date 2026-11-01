import type { LiveService } from '../../live/live-service';
import type { LiveInstance } from '../../live/live.type';
import type { SceneShape } from '../../scene/build-scene';
import type { EcsService } from '../../service/ecs-service';

export interface MoveShapeContext {
  readonly ecs: EcsService;
  readonly live: LiveService;
  /** The running client, while the game plays: the move is then a live edit. */
  readonly client: LiveInstance | undefined;
  readonly scene: string | undefined;
}

/**
 * Moves a shape's entity by `dx`, `dy` scene units: a live edit of the running client, else an
 * edit of its position component's arguments in the code (one undo step).
 */
export const moveShape = (
  { ecs, live, client, scene }: MoveShapeContext,
  shape: SceneShape,
  dx: number,
  dy: number,
): void => {
  const position = shape.position;
  if (!position || (!dx && !dy)) return;
  const x = shape.x + dx;
  const y = shape.y + dy;
  if (client) {
    const entity = client.entities.find(
      (candidate) => candidate.code === shape.entity && candidate.scene === scene,
    );
    if (!entity) return;
    live.setField('client', entity, position.componentName, 'x', x);
    live.setField('client', entity, position.componentName, 'y', y);
    return;
  }
  void ecs.apply(
    {
      kind: 'setArgs',
      entity: shape.entity,
      index: position.component,
      args: { [position.xParam]: { value: x }, [position.yParam]: { value: y } },
      fill: [{ value: 0 }, { value: 0 }],
    },
    `Move ${shape.entity}`,
  );
};
