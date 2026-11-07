import type { ServiceAccessor } from '@nanoforge-dev/editor-sdk';

let services: ServiceAccessor | undefined;

/** The plugin's services, for components mounted by other plugins (code editor side panels). */
export const panelServices = (): ServiceAccessor => {
  if (!services) throw new Error('The ECS plugin is not active');
  return services;
};

export const setPanelServices = (accessor: ServiceAccessor | undefined): void => {
  services = accessor;
};
