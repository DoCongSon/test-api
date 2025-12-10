import pino from 'pino';
import { appConfig } from '../config/env';

export const logger = pino({
  name: appConfig.name,
  level: appConfig.logLevel,
  transport:
    appConfig.env === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});
