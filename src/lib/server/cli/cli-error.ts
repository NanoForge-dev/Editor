import { Exception } from '@utils/exception';

export class CliError extends Exception {
  constructor(message: string) {
    super('Internal Server Error', message, 500);
  }
}
