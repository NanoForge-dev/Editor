import { Exception } from '@utils-server/exception';

export class FileSystemError extends Exception {
  constructor(message: string) {
    super('Bad Request', message, 400);
  }
}
