export class SettingsFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsFileError';
  }
}
