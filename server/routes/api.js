import express from 'express';
import {
  compare,
  compareFiles,
  health,
  rules,
  samplePair,
  validateSpec,
} from '../controllers/comparison.js';
import { compareLimiter, upload, validate } from '../middleware.js';
import { compareSchema, validationRequestSchema } from '../schema.js';

const router = express.Router();

router.get('/health', health);
router.get('/rules', rules);
router.get('/samples', samplePair);
router.post('/validate', validate(validationRequestSchema), validateSpec);
router.post('/compare', compareLimiter, validate(compareSchema), compare);
router.post(
  '/compare/files',
  compareLimiter,
  upload.fields([
    { name: 'baselineFile', maxCount: 1 },
    { name: 'candidateFile', maxCount: 1 },
  ]),
  compareFiles
);

export default router;
