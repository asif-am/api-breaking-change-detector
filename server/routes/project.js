import express from 'express';
import {
  createProject,
  deleteProject,
  getProject,
  listProjectComparisons,
  listProjects,
  runProjectComparison,
  uploadSpecification,
} from '../controllers/project.js';
import { projectComparisonSchema, projectSchema, uploadSpecificationSchema } from '../schema.js';
import { isLoggedIn, upload, validate } from '../middleware.js';

const router = express.Router();

router.use(isLoggedIn);

router.route('/').get(listProjects).post(validate(projectSchema), createProject);
router.route('/:id').get(getProject).delete(deleteProject);

router.post(
  '/:id/specs',
  upload.single('file'),
  validate(uploadSpecificationSchema),
  uploadSpecification
);

router
  .route('/:id/comparisons')
  .get(listProjectComparisons)
  .post(validate(projectComparisonSchema), runProjectComparison);

export default router;
