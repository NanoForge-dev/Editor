import fs from 'node:fs';
import path from 'node:path';

import { FileSystemError } from './file-system-error';

export class ProjectFile {
  private _path: string;
  private readonly projectPath: string;

  constructor(filePath: string, projectPath: string) {
    this._path = path.resolve(projectPath, './' + filePath);
    this.projectPath = projectPath;

    this._checkPathIsInsideProject();
  }

  get path(): string {
    this._checkPathExists();
    return this._path;
  }

  read(encoding?: BufferEncoding): string {
    this.isReadable();
    return fs.readFileSync(this._path).toString(encoding);
  }

  readJson<T = any>(): T {
    const raw = this.read();
    return JSON.parse(raw) as T;
  }

  write(text: string): void {
    const folderPath = path.dirname(this._path);
    try {
      this._checkPathExists();
      this._checkPathIsFile();
      this._checkPathIsWritable();
    } catch {
      fs.mkdirSync(folderPath, { recursive: true });
      fs.writeFileSync(this._path, text, { flush: true });
      return;
    }
    this._checkPathExists(folderPath);
    this._checkPathIsDir(folderPath);
    this._checkPathIsWritable(folderPath);
    fs.writeFileSync(this._path, text, { flush: true });
  }

  writeJson(content: any): void {
    const raw = JSON.stringify(content);
    this.write(raw);
  }

  delete(): void {
    this._checkPathExists();
    this._checkPathIsFile();
    this._checkPathIsWritable();
    fs.rmSync(this._path);
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
    fs.renameSync(this._path, absoluteNewPath);
    this._path = absoluteNewPath;
  }

  isReadable(): void {
    this._checkPathExists();
    this._checkPathIsFile();
    this._checkPathIsReadable();
  }

  private _checkPathIsInsideProject(path: string = this._path) {
    if (!path.startsWith(this.projectPath)) {
      throw new FileSystemError(`Path ${path} is outside of the project directory`);
    }
  }

  private _checkPathExists(path: string = this._path) {
    if (!fs.existsSync(path)) {
      throw new FileSystemError(`Path ${path} should exist`);
    }
  }

  private _checkPathNotExists(path: string = this._path) {
    if (fs.existsSync(path)) {
      throw new FileSystemError(`Path ${path} should not exist`);
    }
  }

  private _checkPathIsFile(path: string = this._path) {
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

  private _checkPathIsDir(path: string = this._path) {
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

  private _checkPathIsWritable(path: string = this._path) {
    try {
      fs.accessSync(path, fs.constants.W_OK);
    } catch {
      throw new FileSystemError(`Path ${path} writable`);
    }
  }

  private _checkPathIsReadable(path: string = this._path) {
    try {
      fs.accessSync(path, fs.constants.R_OK);
    } catch {
      throw new FileSystemError(`Path ${path} writable`);
    }
  }
}
