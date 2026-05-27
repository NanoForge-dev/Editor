import type { AddComponentBody } from '$lib/server/actions/project/package/add-components.action';
import type { AddSystemBody } from '$lib/server/actions/project/package/add-systems.action';
import type { CreateComponentBody } from '$lib/server/actions/project/package/create-component.action';
import type { CreateSystemBody } from '$lib/server/actions/project/package/create-system.action';
import type { GetComponentManifestBody } from '$lib/server/actions/project/package/get-components-manifests.action';
import type { GetSystemManifestBody } from '$lib/server/actions/project/package/get-systems-manifests.action';
import type {
  NewComponentPackage,
  NewSystemPackage,
} from '$lib/server/project/package/package.type';

export type NewComponentPackageResult = NewComponentPackage;

export type NewSystemPackageResult = NewSystemPackage;

export type AddComponentsActionInput = AddComponentBody;

export type AddSystemsActionInput = AddSystemBody;

export type GetComponentsManifestsActionInput = GetComponentManifestBody;

export type GetSystemsManifestsActionInput = GetSystemManifestBody;

export type CreateComponentActionInput = CreateComponentBody;

export type CreateSystemActionInput = CreateSystemBody;
