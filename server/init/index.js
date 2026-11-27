import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import { compareSpecifications, validateSpecification } from '../engine/index.js';
import { storedSummary } from '../engine/report.js';
import { connectDatabase } from '../config/database.js';
import User from '../models/user.js';
import Project from '../models/project.js';
import Specification from '../models/specification.js';
import Comparison from '../models/comparison.js';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const DEMO_PASSWORD_PLACEHOLDER = 'replace-with-a-demo-password';

const baseline = JSON.parse(fs.readFileSync(new URL('../samples/baseline.json', import.meta.url), 'utf8'));
const candidate = JSON.parse(fs.readFileSync(new URL('../samples/candidate.json', import.meta.url), 'utf8'));

async function seed() {
  if (!DEMO_PASSWORD || DEMO_PASSWORD === DEMO_PASSWORD_PLACEHOLDER) {
    console.error(
      'Set a real DEMO_PASSWORD in server/.env before running "npm run seed" (the template placeholder is not a password).'
    );
    process.exit(1);
  }

  const connection = await connectDatabase();
  if (!connection.connected) {
    console.error('MongoDB is not reachable. Start MongoDB and run "npm run seed" again.');
    process.exit(1);
  }

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await User.register(new User({ name: 'Demo User', email: DEMO_EMAIL }), DEMO_PASSWORD);
    console.log(`Created demo account (${DEMO_EMAIL}).`);
  }

  const existing = await Project.findOne({ owner: user._id, name: 'Acme Orders API' });
  if (existing) {
    await Specification.deleteMany({ project: existing._id });
    await Comparison.deleteMany({ project: existing._id });
    await Project.deleteOne({ _id: existing._id });
  }

  const project = await Project.create({
    owner: user._id,
    name: 'Acme Orders API',
    description: 'Sample project created by the seed script for the comparison walkthrough.',
  });

  const validations = {
    baseline: validateSpecification(baseline, 'Baseline specification'),
    candidate: validateSpecification(candidate, 'Candidate specification'),
  };

  await Specification.insertMany(
    Object.entries({ baseline, candidate }).map(([role, document]) => ({
      project: project._id,
      role,
      name: `${role}.json`,
      version: validations[role].meta.version,
      openapi: validations[role].meta.openapi,
      operationCount: validations[role].operationCount,
      sizeBytes: Buffer.byteLength(JSON.stringify(document)),
      document,
    }))
  );

  const report = compareSpecifications({ baseline, candidate });

  await Comparison.create({
    project: project._id,
    owner: user._id,
    baselineSpec: { specId: '', name: 'baseline.json', version: validations.baseline.meta.version },
    candidateSpec: { specId: '', name: 'candidate.json', version: validations.candidate.meta.version },
    options: report.meta.options,
    summary: storedSummary(report),
    resultDigest: report.meta.deterministic.resultDigest,
    report,
  });

  console.log(`Seeded project "${project.name}" with ${report.summary.total} changes.`);
  console.log(`Sign in with ${DEMO_EMAIL} and the DEMO_PASSWORD from server/.env.`);

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
