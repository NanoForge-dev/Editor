import { type FileSystemDirectory } from '../../utils/file-system';
import type { SaveHandler } from './save/save-handler';

export class Project {
  private readonly _fs: FileSystemDirectory;
  private readonly _saveHandler: SaveHandler;

  constructor(fs: FileSystemDirectory, saveHandler: SaveHandler) {
    this._fs = fs;
    this._saveHandler = saveHandler;
  }

  get save(): SaveHandler {
    return this._saveHandler;
  }
}
