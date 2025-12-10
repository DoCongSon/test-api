import http from 'http';
import { app } from './app';
import { appConfig } from './config/env';
import { logger } from './lib/logger';

const server = http.createServer(app);

const onListening = (): void => {
  logger.info(
    { port: appConfig.port, host: appConfig.host, env: appConfig.env },
    'HTTP server started',
  );
};

const onError = (error: NodeJS.ErrnoException): void => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = `Port ${appConfig.port}`;

  switch (error.code) {
    case 'EACCES':
      logger.error({ bind }, 'Requires elevated privileges');
      process.exit(1);
      return;
    case 'EADDRINUSE':
      logger.error({ bind }, 'Port is already in use');
      process.exit(1);
      return;
    default:
      throw error;
  }
};

server.on('error', onError);
server.on('listening', onListening);

server.listen(appConfig.port, appConfig.host);

const shutdown = (signal: NodeJS.Signals): void => {
  logger.info({ signal }, 'Shutting down server');
  server.close((closeError?: Error | null) => {
    if (closeError) {
      logger.error({ closeError }, 'Error during server shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});
