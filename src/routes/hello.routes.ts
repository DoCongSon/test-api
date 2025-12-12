import { Router } from 'express';
import { helloAuthenticatedController, helloController } from '../controllers/hello.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', helloController);
router.get('/secure', requireAuth, helloAuthenticatedController);

export const helloRouter = router;
