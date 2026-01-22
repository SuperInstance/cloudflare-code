/**
 * Logger utilities
 */

import { Logger } from '../types';

/**
 * Create a console logger
 */
export function createConsoleLogger(prefix: string = ''): Logger {
  return {
    debug: (message: string, ...args: any[]) => {
      if (process.env.DEBUG) {
        console.debug(`[${prefix}] DEBUG: ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      console.info(`[${prefix}] INFO: ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${prefix}] WARN: ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${prefix}] ERROR: ${message}`, ...args);
    }
  };
}

/**
 * Create a null logger (discards all output)
 */
export function createNullLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

/**
 * Create a composite logger
 */
export function createCompositeLogger(loggers: Logger[]): Logger {
  return {
    debug: (message: string, ...args: any[]) => {
      for (const logger of loggers) {
        logger.debug(message, ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      for (const logger of loggers) {
        logger.info(message, ...args);
      }
    },
    warn: (message: string, ...args: any[]) => {
      for (const logger of loggers) {
        logger.warn(message, ...args);
      }
    },
    error: (message: string, ...args: any[]) => {
      for (const logger of loggers) {
        logger.error(message, ...args);
      }
    }
  };
}

/**
 * Create a filtered logger
 */
export function createFilteredLogger(
  logger: Logger,
  level: 'debug' | 'info' | 'warn' | 'error' = 'info'
): Logger {
  const levels = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(level);

  return {
    debug: minLevel <= 0 ? logger.debug.bind(logger) : () => {},
    info: minLevel <= 1 ? logger.info.bind(logger) : () => {},
    warn: minLevel <= 2 ? logger.warn.bind(logger) : () => {},
    error: minLevel <= 3 ? logger.error.bind(logger) : () => {}
  };
}
