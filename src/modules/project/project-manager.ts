import { FileSystemManager } from '../../utils/file-system';
import { LocalFileSystem } from '../../utils/local-file-system';
import { Project } from './project';
import { SaveHandler } from './save/save-handler';

export class ProjectManager {
  private _currentId: string | null = null;
  private _current: Project | null = null;
  private _fs: FileSystemManager;

  constructor() {
    this._fs = new FileSystemManager('projects');
  }

  getProject(): Project {
    if (!this._current) throw new Error('No project loaded');
    return this._current;
  }

  async create(name: string): Promise<void> {
    if (await this._fs.directoryExist(name))
      throw new Error(`Project named "${name}" already exists`);

    await this._loadProject(name);
    await this._postLoad();
  }

  async loadFromSave(name: string): Promise<void> {
    if (!(await this._fs.directoryExist(name)))
      throw new Error(`Project named "${name}" does not exists`);

    await this._loadProject(name);
    await this._postLoad();
  }

  async loadFromLocal(name: string): Promise<void> {
    if (await this._fs.directoryExist(name))
      throw new Error(`Project named "${name}" already exists`);

    await this._loadProject(name);
    const localFs = new LocalFileSystem('projects');
    await localFs.askFileAndCache(`${name}/save.nfps`);
    await this._postLoad();
  }

  close(): void {
    this._currentId = null;
    this._current = null;
  }

  private async _loadProject(name: string): Promise<void> {
    this._currentId = name;
    const dir = await this._fs.getDirectory(name);

    const save = new SaveHandler(await dir.getFile('save.nfps'));
    this._current = new Project(dir, save);
  }

  private async _postLoad(): Promise<void> {
    await this._current?.save.fetchSave();
    this._current?.save.enableAutoSave();
  }
}
