import { Router } from 'express';
import { healthRouter } from './health.routes';
import { helloRouter } from './hello.routes';
import { authRouter } from './auth.routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/hello', helloRouter);
router.use('/auth', authRouter);

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'running',
    endpoints: {
      health: '/health',
      hello: '/hello',
      auth: '/auth',
    },
  });
});

export const apiRouter = router;
