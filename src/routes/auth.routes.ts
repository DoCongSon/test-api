import { Router } from 'express';
import { createSession, getCurrentUser, revokeSession } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.post('/session', asyncHandler(createSession));
router.get('/me', requireAuth, getCurrentUser);
router.delete('/session', requireAuth, asyncHandler(revokeSession));

export const authRouter = router;
