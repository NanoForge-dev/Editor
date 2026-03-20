export interface DirectoryRec {
  files: string[];
  directories: Record<string, DirectoryRec>;
}

export abstract class ProjectApi {
  abstract createProject(formData: FormData): Promise<void>;
  abstract loadProject(formData: FormData): Promise<void>;

  abstract playProject(): Promise<void>;
  abstract stopProject(): Promise<void>;

  abstract uploadFiles(): Promise<void>;
  abstract downloadFiles(): Promise<void>;
}
