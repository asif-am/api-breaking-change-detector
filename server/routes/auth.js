import express from 'express';
import { login, logout, me, register } from '../controllers/auth.js';
import { authLimiter, validate } from '../middleware.js';
import { loginSchema, registerSchema } from '../schema.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', me);

export default router;
