import { EditorEvents, type EventHandler } from '$lib/client/event';
import { useProject } from '$lib/client/project';

export const moveComponentListener = (handler: EventHandler): (() => void) => {
  handler.on(EditorEvents.MOVE_COMPONENT, (entityId, _componentId, { x, y }) => {
    const { ecs } = useProject();
    const entity = ecs.scenes.activeData.entities.get(entityId);
    const component = entity.components.get('Position2D');
    component.params.get('x').value.set(x);
    component.params.get('y').value.set(y);
  });
  return () => {};
};
