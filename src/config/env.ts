import { config } from 'dotenv';

config();

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value ?? '3000');
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('PORT must be a positive integer');
  }
  return parsed;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? `${fallback}`);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export interface AppConfig {
  readonly name: string;
  readonly env: string;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly sessionMaxAgeMs: number;
  readonly appInsightsConnectionString?: string;
}

export const appConfig: AppConfig = {
  name: process.env.APP_NAME ?? 'test-api',
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: parsePort(process.env.PORT),
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  sessionMaxAgeMs: parsePositiveInt(process.env.SESSION_MAX_AGE_DAYS, 7) * 24 * 60 * 60 * 1000,
  appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
};
