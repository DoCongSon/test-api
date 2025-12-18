import './instrumentation';

import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { appConfig } from './config/env';
import { logger } from './lib/logger';
import { apiRouter } from './routes';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan(appConfig.env === 'production' ? 'combined' : 'dev', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }),
);

app.use('/', apiRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  logger.error({ err, path: req.path }, 'Unhandled error');

  const maybeStatus =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined;
  const isValidStatus =
    typeof maybeStatus === 'number' &&
    Number.isInteger(maybeStatus) &&
    maybeStatus >= 400 &&
    maybeStatus <= 599;
  const statusCode = isValidStatus ? maybeStatus : 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Request Failed',
  });
});

export { app };
