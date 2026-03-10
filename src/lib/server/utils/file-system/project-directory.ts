import { FileSystemError } from '@utils-server/file-system/file-system-error';
import fs from 'node:fs';
import path from 'node:path';

export class ProjectDirectory {
  private path: string;
  private readonly projectPath: string;

  constructor(dirPath: string, projectPath: string) {
    this.path = path.resolve(projectPath, './' + dirPath);
    this.projectPath = projectPath;
  }

  read(recursive: boolean = false): { files: string[]; directories: {} } {
    this._checkPathIsInsideProject();
    this._checkPathExists();
    this._checkPathIsDir();
    this._checkPathIsReadable();
    return this._readDirContent(this.path, recursive);
  }

  create(): void {
    this._checkPathIsInsideProject();
    this._checkPathNotExists();

    fs.mkdirSync(this.path, { recursive: true });
  }

  delete(recursive: boolean = false): void {
    this._checkPathIsInsideProject();
    this._checkPathExists();
    this._checkPathIsDir();
    if (!recursive) {
      this._checkDirIsEmpty();
    }
    fs.rmSync(this.path, { recursive: recursive });
  }

  rename(newPath: string): void {
    const absoluteNewDirPath = path.resolve(this.projectPath, './' + newPath);
    this._checkPathIsInsideProject();
    this._checkPathIsInsideProject(absoluteNewDirPath);
    this._checkPathExists();
    this._checkPathIsDir();
    this._checkPathIsWritable();
    const newFolderPath = path.dirname(absoluteNewDirPath);
    this._checkPathExists(newFolderPath);
    this._checkPathIsWritable(newFolderPath);
    this._checkPathNotExists(absoluteNewDirPath);
    fs.renameSync(this.path, absoluteNewDirPath);
    this.path = absoluteNewDirPath;
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

  private _checkDirIsEmpty(path: string = this.path) {
    if (fs.readdirSync(path).length > 0) {
      throw new FileSystemError(`Directory ${path} is not empty`);
    }
  }

  private _readDirContent(
    path: string = this.path,
    recursive: boolean = false,
  ): { files: string[]; directories: {} } {
    const dirContent: { files: string[]; directories: { [key: string]: any } } = {
      files: [],
      directories: {},
    };
    fs.readdirSync(path, { withFileTypes: true, recursive: false }).forEach((item) => {
      if (item.isFile()) {
        dirContent.files.push(item.name);
      } else if (item.isDirectory()) {
        dirContent.directories[item.name] = recursive
          ? this._readDirContent(path + '/' + item.name, recursive)
          : {};
      }
    });
    return dirContent;
  }
}
