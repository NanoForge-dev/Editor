<<<<<<< HEAD
import { FileSystemError } from '@utils-server/file-system/file-system-error';
=======
import { FileSystemError } from '@utils-server/file-system/fileSystemError';
>>>>>>> 3ed1389 (fix(back): fs naming convention)
import fs from 'node:fs';
import path from 'node:path';

export class ProjectFile {
  private path: string;
  private readonly projectPath: string;

  constructor(filePath: string, projectPath: string) {
    this.path = path.resolve(projectPath, './' + filePath);
    this.projectPath = projectPath;
  }

  read(): string {
    this._checkPathIsInsideProject();
    this._checkPathExists();
    this._checkPathIsFile();
    this._checkPathIsReadable();
    return fs.readFileSync(this.path).toString();
  }

  readJson<T = any>(): T {
    const raw = this.read();
    return JSON.parse(raw) as T;
  }

  write(text: string): void {
    this._checkPathIsInsideProject();
    try {
      this._checkPathExists();
    } catch {
      this._checkPathIsFile();
      this._checkPathIsWritable();
      fs.writeFileSync(this.path, text, { flush: true });
      return;
    }
    const folderPath = path.dirname(this.path);
    this._checkPathExists(folderPath);
    this._checkPathIsDir(folderPath);
    this._checkPathIsWritable(folderPath);
    fs.writeFileSync(this.path, text, { flush: true });
  }

  writeJson(content: any): void {
    const raw = JSON.stringify(content);
    this.write(raw);
  }

  delete(): void {
    this._checkPathIsInsideProject();
    this._checkPathExists();
    this._checkPathIsFile();
    this._checkPathIsWritable();
    fs.rmSync(this.path);
  }

  rename(newPath: string): void {
    const absoluteNewPath = path.resolve(this.projectPath, './' + newPath);
    this._checkPathIsInsideProject(newPath);
    this._checkPathExists();
    this._checkPathIsFile();
    this._checkPathIsWritable();
    const newFolderPath = path.dirname(absoluteNewPath);
    this._checkPathExists(newFolderPath);
    this._checkPathIsWritable(newFolderPath);
    this._checkPathNotExists(absoluteNewPath);
    fs.renameSync(this.path, absoluteNewPath);
    this.path = absoluteNewPath;
  }

  private _checkPathIsInsideProject(path: string = this.path) {
    if (!path.startsWith(this.projectPath)) {
      throw new FileSystemError(`Path ${path} is outside of the project directory`);
    }
  }

  private _checkPathExists(path: string = this.path) {
    if (!fs.existsSync(path)) {
      throw new FileSystemError(`Path ${path} should exist`);
    }
  }

  private _checkPathNotExists(path: string = this.path) {
    if (fs.existsSync(path)) {
      throw new FileSystemError(`Path ${path} should not exist`);
    }
  }

  private _checkPathIsFile(path: string = this.path) {
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(path);
    } catch {
      throw new FileSystemError(`Path ${path} does not exist`);
    }
    if (!stats.isFile()) {
      throw new FileSystemError(`Path ${path} is not a this.path`);
    }
  }

  private _checkPathIsDir(path: string = this.path) {
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(path);
    } catch {
      throw new FileSystemError(`Path ${path} does not exist`);
    }
    if (!stats.isDirectory()) {
      throw new FileSystemError(`Path ${path} is not a directory`);
    }
  }

  private _checkPathIsWritable(path: string = this.path) {
    try {
      fs.accessSync(path, fs.constants.W_OK);
    } catch {
      throw new FileSystemError(`Path ${path} writable`);
    }
  }

  private _checkPathIsReadable(path: string = this.path) {
    try {
      fs.accessSync(path, fs.constants.R_OK);
    } catch {
      throw new FileSystemError(`Path ${path} writable`);
    }
  }
}
