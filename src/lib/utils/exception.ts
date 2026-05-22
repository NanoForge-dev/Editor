export class Exception extends Error {
  constructor(
    public error: string,
    public message: string,
    public status: number,
    options?: { cause?: Error },
  ) {
    super(`${error}: ${message}`, options);
  }
}
