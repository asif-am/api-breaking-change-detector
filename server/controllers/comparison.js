import fs from 'node:fs';
import {
  compareSpecifications,
  ENGINE_VERSION,
  ruleCatalog,
  validateSpecification,
} from '../engine/index.js';
import { databaseState } from '../config/database.js';
import { store, getPersistenceMode } from '../data/store.js';

const samples = {
  baseline: JSON.parse(fs.readFileSync(new URL('../samples/baseline.json', import.meta.url), 'utf8')),
  candidate: JSON.parse(fs.readFileSync(new URL('../samples/candidate.json', import.meta.url), 'utf8')),
};

function parseOptions(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/* ------------------------------ public API ------------------------------- */

/** GET /api/health */
export function health(req, res) {
  return res.json({
    success: true,
    data: {
      status: 'ok',
      engineVersion: ENGINE_VERSION,
      persistence: getPersistenceMode(),
      database: databaseState(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}

/** GET /api/rules */
export function rules(req, res) {
  return res.json({ success: true, data: ruleCatalog() });
}

/** GET /api/samples */
export function samplePair(req, res) {
  return res.json({ success: true, data: samples });
}

/** POST /api/validate */
export function validateSpec(req, res, next) {
  try {
    const { specification, label } = req.body;
    const result = validateSpecification(specification, label);
    return res.status(result.valid ? 200 : 422).json({ success: result.valid, data: result });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/compare */
export function compare(req, res, next) {
  try {
    const { baseline, candidate, options } = req.body;
    const report = compareSpecifications({ baseline, candidate, options: parseOptions(options) });

    return res.json({
      success: true,
      data: report,
      ci: report.ci,
      verdict: report.verdict,
    });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/compare/files (multipart: baselineFile, candidateFile, options) */
export function compareFiles(req, res, next) {
  try {
    const baselineFile = req.files?.baselineFile?.[0];
    const candidateFile = req.files?.candidateFile?.[0];

    if (!baselineFile || !candidateFile) {
      return res.status(400).json({
        success: false,
        message: 'Attach both "baselineFile" and "candidateFile" as .json files.',
      });
    }

    const report = compareSpecifications({
      baseline: baselineFile.buffer.toString('utf8'),
      candidate: candidateFile.buffer.toString('utf8'),
      options: parseOptions(req.body?.options),
    });

    return res.json({ success: true, data: report, ci: report.ci, verdict: report.verdict });
  } catch (error) {
    return next(error);
  }
}

/* --------------------------- saved comparisons --------------------------- */

/** GET /api/comparisons/:id */
export async function getComparison(req, res, next) {
  try {
    const comparison = await store.comparisons.findByIdForOwner(req.params.id, req.user.id);
    if (!comparison) {
      return res.status(404).json({ success: false, message: 'Comparison not found.' });
    }
    return res.json({ success: true, data: { comparison, report: comparison.report } });
  } catch (error) {
    return next(error);
  }
}

/** DELETE /api/comparisons/:id */
export async function deleteComparison(req, res, next) {
  try {
    const removed = await store.comparisons.remove(req.params.id, req.user.id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Comparison not found.' });
    }
    return res.json({ success: true, message: 'Comparison deleted.' });
  } catch (error) {
    return next(error);
  }
}
