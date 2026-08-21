export class CliError extends Error {
  constructor(message, exitCode = 1, details) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    if (details !== undefined) this.details = details;
  }
}