// @ts-nocheck
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHandlers: Map<string, (error: Error) => void> = new Map();

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  registerErrorHandler(errorType: string, handler: (error: Error) => void): void {
    this.errorHandlers.set(errorType, handler);
  }

  handle(error: Error, context?: any): void {
    const errorType = this.getErrorType(error);
    const handler = this.errorHandlers.get(errorType);

    if (handler) {
      handler(error);
    } else {
      this.defaultHandler(error, context);
    }
  }

  private getErrorType(error: Error): string {
    if (error.name === 'TimeoutError') return 'timeout';
    if (error.name === 'NetworkError') return 'network';
    if (error.name === 'ValidationError') return 'validation';
    if (error.name === 'AuthenticationError') return 'authentication';
    if (error.name === 'AuthorizationError') return 'authorization';
    return 'unknown';
  }

  private defaultHandler(error: Error, context?: any): void {
    console.error('Unhandled error:', error.message, error.stack, context);
  }
}