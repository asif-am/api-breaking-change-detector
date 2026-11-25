import express from 'express';
import { deleteComparison, getComparison } from '../controllers/comparison.js';
import { isLoggedIn } from '../middleware.js';

const router = express.Router();

router.use(isLoggedIn);

router.get('/:id', getComparison);
router.delete('/:id', deleteComparison);

export default router;
