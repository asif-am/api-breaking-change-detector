import { compareSpecifications, validateSpecification } from '../engine/index.js';
import { store } from '../data/store.js';

// MongoDB documents are capped at 16 MB; keep a safety margin below that.
const MAX_STORED_REPORT_BYTES = 12 * 1024 * 1024;

function parseOptions(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** GET /api/projects */
export async function listProjects(req, res, next) {
  try {
    const projects = await store.projects.listByOwner(req.user.id);
    return res.json({ success: true, data: { projects } });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/projects */
export async function createProject(req, res, next) {
  try {
    const { name, description } = req.body;

    const project = await store.projects.create({
      owner: req.user.id,
      name,
      description,
    });

    return res.status(201).json({ success: true, data: { project } });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/projects/:id */
export async function getProject(req, res, next) {
  try {
    const project = await store.projects.findByIdForOwner(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const [specifications, comparisons] = await Promise.all([
      store.specifications.listByProject(project.id),
      store.comparisons.listByProject(project.id),
    ]);

    return res.json({ success: true, data: { project, specifications, comparisons } });
  } catch (error) {
    return next(error);
  }
}

/** DELETE /api/projects/:id */
export async function deleteProject(req, res, next) {
  try {
    const project = await store.projects.findByIdForOwner(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    await store.projects.remove(project.id);
    return res.json({ success: true, message: 'Project deleted.' });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/projects/:id/specs (multipart: file, role) */
export async function uploadSpecification(req, res, next) {
  try {
    const project = await store.projects.findByIdForOwner(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach the specification as a .json file.' });
    }

    const role = req.body.role;
    const text = req.file.buffer.toString('utf8');

    let document;
    try {
      document = JSON.parse(text);
    } catch {
      return res.status(422).json({
        success: false,
        message: 'The uploaded file is not valid JSON. Export the OpenAPI document as JSON and try again.',
      });
    }

    // Re-use the engine validator so uploads and comparisons share one contract.
    const validation = validateSpecification(
      document,
      role === 'baseline' ? 'Baseline specification' : 'Candidate specification'
    );

    if (!validation.valid) {
      return res.status(422).json({
        success: false,
        message: validation.message,
        issues: validation.issues,
      });
    }

    const specification = await store.specifications.replaceForRole({
      project: project.id,
      role,
      name: String(req.body.name || req.file.originalname || `${role}.json`).slice(0, 120),
      version: validation.meta.version,
      openapi: validation.meta.openapi,
      operationCount: validation.operationCount,
      sizeBytes: Buffer.byteLength(text),
      document,
    });

    return res.status(201).json({ success: true, data: { specification } });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/projects/:id/comparisons */
export async function runProjectComparison(req, res, next) {
  try {
    const project = await store.projects.findByIdForOwner(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const [baseline, candidate] = await Promise.all([
      store.specifications.findByRole(project.id, 'baseline'),
      store.specifications.findByRole(project.id, 'candidate'),
    ]);

    if (!baseline || !candidate) {
      return res.status(400).json({
        success: false,
        message: 'Upload both a baseline and a candidate specification before running a comparison.',
      });
    }

    const report = compareSpecifications({
      baseline: baseline.document,
      candidate: candidate.document,
      options: parseOptions(req.body.options),
    });

    const reportBytes = Buffer.byteLength(JSON.stringify(report));
    if (reportBytes > MAX_STORED_REPORT_BYTES) {
      return res.status(413).json({
        success: false,
        message: `The generated report is ${(reportBytes / (1024 * 1024)).toFixed(1)} MB and cannot be stored (limit 12 MB). Reduce the specification size or ignore some paths, then run the comparison again.`,
      });
    }

    const comparison = await store.comparisons.create({
      project: project.id,
      owner: req.user.id,
      baselineSpec: { specId: baseline.id, name: baseline.name, version: baseline.version },
      candidateSpec: { specId: candidate.id, name: candidate.name, version: candidate.version },
      options: report.meta.options,
      summary: {
        total: report.summary.total,
        breaking: report.summary.breaking,
        potentiallyBreaking: report.summary.potentiallyBreaking,
        nonBreaking: report.summary.nonBreaking,
      },
      resultDigest: report.meta.deterministic.resultDigest,
      report,
    });

    return res.status(201).json({ success: true, data: { comparison, report } });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/projects/:id/comparisons */
export async function listProjectComparisons(req, res, next) {
  try {
    const project = await store.projects.findByIdForOwner(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const comparisons = await store.comparisons.listByProject(project.id);
    return res.json({ success: true, data: { comparisons } });
  } catch (error) {
    return next(error);
  }
}
