export class FileSystemError extends Error {
  message: string;
  constructor(message: string) {
    super();
    this.message = message;
  }
}
