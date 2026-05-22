import type { LoadProjectBody } from '$lib/server/actions/project/load.action';
import type { CreateProjectBody } from '$lib/server/actions/project/new.action';
import type { Project } from '$lib/server/project';

export type ActionProject = Project;

export type LoadProjectActionInput = LoadProjectBody;

export type CreateProjectActionInput = CreateProjectBody;
