import { type FileSystemFile } from '../../../utils/file-system';
import type { ISave } from './save.type';

export class SaveHandler {
  public data!: ISave;
  private _fs!: FileSystemFile;
  private _autoSaveStatus: number | null = null;
  private _autoSaveInterval: number = 10 * 1000;

  constructor(fs: FileSystemFile) {
    this._fs = fs;
  }

  async fetchSave(): Promise<void> {
    this.data = await this._fs.readJson<ISave>();
  }

  async save(): Promise<void> {
    await this._fs.writeJson(this.data);
  }

  enableAutoSave(): void {
    if (this._autoSaveStatus !== null) return;
    this._autoSaveStatus = setInterval(async () => {
      await this.save();
    }, this._autoSaveInterval);
  }

  disableAutoSave(): void {
    if (this._autoSaveStatus === null) return;
    clearInterval(this._autoSaveStatus);
    this._autoSaveStatus = null;
  }
}
