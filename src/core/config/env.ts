/**
 * Validated environment configuration.
 *
 * All environment variables MUST be prefixed with EXPO_PUBLIC_ (inlined by
 * Expo at build time) and declared in this schema. Nothing in the app reads
 * `process.env` directly.
 */
import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  EXPO_PUBLIC_API_BASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_AI_BASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_DEFAULT_LOCALE: z.enum(['ar', 'en']).default('ar'),
  EXPO_PUBLIC_DEFAULT_CURRENCY: z.string().min(3).max(3).default('YER'),
  EXPO_PUBLIC_ENABLE_OFFLINE_SYNC: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  EXPO_PUBLIC_ENABLE_AI: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

const rawEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  // Fail fast at startup with a readable message instead of deep runtime errors.
  throw new Error(
    `Invalid environment configuration:\n${parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`,
  );
}

export const env = {
  appEnvironment: parsed.data.EXPO_PUBLIC_APP_ENV,
  apiBaseUrl: parsed.data.EXPO_PUBLIC_API_BASE_URL,
  aiBaseUrl: parsed.data.EXPO_PUBLIC_AI_BASE_URL,
  defaultLocale: parsed.data.EXPO_PUBLIC_DEFAULT_LOCALE,
  defaultCurrency: parsed.data.EXPO_PUBLIC_DEFAULT_CURRENCY,
  offlineSyncEnabled: parsed.data.EXPO_PUBLIC_ENABLE_OFFLINE_SYNC,
  aiEnabled: parsed.data.EXPO_PUBLIC_ENABLE_AI,
} as const;

export const isProduction = env.appEnvironment === 'production';
export const isDevelopment = env.appEnvironment === 'development';
