import type { CompleteProjectBody } from '$lib/server/actions/project/complete.action';
import type { GatewayProject } from '$lib/server/actions/project/gateway.action';
import type { InfoProject, InfoProjectBody } from '$lib/server/actions/project/info.action';
import type { LoadProjectBody } from '$lib/server/actions/project/load.action';
import type { CreateProjectBody } from '$lib/server/actions/project/new.action';
import type { Project } from '$lib/server/project';

export type ActionProject = Project;

export type LoadProjectActionInput = LoadProjectBody;

export type CreateProjectActionInput = CreateProjectBody;
export type CompleteProjectActionInput = CompleteProjectBody;

export type InfoProjectResult = InfoProject;
export type InfoProjectInput = InfoProjectBody;

export type GatewayProjectResult = GatewayProject;
