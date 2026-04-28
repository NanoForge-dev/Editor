import { Exception } from '@utils-server/exception';

export class CliError extends Exception {
  constructor(message: string) {
    super('Internal Server Error', message, 500);
  }
}
