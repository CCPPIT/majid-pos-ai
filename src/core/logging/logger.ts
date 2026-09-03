/**
 * Lightweight structured logger with sensitive-data redaction.
 * Never logs tokens, PINs, passwords or biometric material (Section 47).
 */
import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYS = [
  'password',
  'pin',
  'token',
  'accesstoken',
  'refreshtoken',
  'otp',
  'secret',
  'authorization',
  'biometric',
  'cardnumber',
  'cvv',
];

const REDACTED = '[REDACTED]';

export const redact = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        SENSITIVE_KEYS.some((s) => key.toLowerCase().replace(/[_\s-]/g, '').includes(s))
          ? REDACTED
          : redact(v),
      ]),
    ) as T;
  }
  return value;
};

const shouldLog = (level: LogLevel): boolean => {
  const minLevel: LogLevel = env.appEnvironment === 'production' ? 'info' : 'debug';
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
};

const write = (level: LogLevel, message: string, context?: unknown): void => {
  if (!shouldLog(level)) return;
  const safeContext = context === undefined ? '' : redact(context);
  const prefix = `[MAJID:${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, message, safeContext);
  } else if (level === 'warn') {
    console.warn(prefix, message, safeContext);
  } else {
    console.log(prefix, message, safeContext);
  }
};

export const logger = {
  debug: (message: string, context?: unknown) => write('debug', message, context),
  info: (message: string, context?: unknown) => write('info', message, context),
  warn: (message: string, context?: unknown) => write('warn', message, context),
  error: (message: string, context?: unknown) => write('error', message, context),
};
