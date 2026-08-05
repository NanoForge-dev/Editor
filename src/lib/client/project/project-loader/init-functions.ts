import type { Project } from '$lib/client/project';
import { updateTabsStore } from '$lib/components/Tabs/store';

export const initTabs = (project: Project) => {
  updateTabsStore(project.id);
};
