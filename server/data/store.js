import mongoose from 'mongoose';
import User from '../models/user.js';
import Project from '../models/project.js';
import Specification from '../models/specification.js';
import Comparison from '../models/comparison.js';

/**
 * Repository layer (FR-23, FR-24, AC-11).
 *
 * Two interchangeable adapters hide the storage decision from the controllers:
 *   - mongodb : durable persistence when MongoDB is reachable
 *   - memory  : ephemeral demo persistence so the project runs anywhere
 * Both return the same plain objects, so the API contract never changes.
 */

let mode = 'memory';

const memory = {
  users: [],
  projects: [],
  specifications: [],
  comparisons: [],
  sequence: 0,
};

export function setPersistenceMode(nextMode) {
  mode = nextMode === 'mongodb' ? 'mongodb' : 'memory';
}

export function getPersistenceMode() {
  return mode;
}

function usingMongo() {
  return mode === 'mongodb' && mongoose.connection.readyState === 1;
}

function nextId(prefix) {
  memory.sequence += 1;
  return `${prefix}${memory.sequence}`;
}

/** Mongoose documents are converted to plain objects before they leave the store. */
const plain = (document) =>
  document && typeof document.toObject === 'function' ? document.toObject() : document;

/** Mongo records expose _id, in-memory records expose id. */
const idOf = (document) => String(document._id ?? document.id);

const serialise = (document, build) => {
  const value = plain(document);
  return value ? build(value) : null;
};

const specReference = (reference) => ({
  specId: String(reference?.specId || ''),
  name: reference?.name || '',
  version: reference?.version || '',
});

const serialiseUser = (document) =>
  serialise(document, (user) => ({
    id: idOf(user),
    name: user.name,
    email: user.email,
    password: user.password,
    createdAt: user.createdAt,
  }));

const serialiseProject = (document) =>
  serialise(document, (project) => ({
    id: idOf(project),
    owner: String(project.owner?._id ?? project.owner ?? ''),
    name: project.name,
    description: project.description || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }));

const serialiseSpecification = (document, withDocument = true) =>
  serialise(document, (spec) => ({
    id: idOf(spec),
    project: String(spec.project?._id ?? spec.project ?? ''),
    role: spec.role,
    name: spec.name,
    version: spec.version || '0.0.0',
    openapi: spec.openapi || '',
    operationCount: spec.operationCount || 0,
    sizeBytes: spec.sizeBytes || 0,
    createdAt: spec.createdAt,
    updatedAt: spec.updatedAt,
    ...(withDocument ? { document: spec.document } : {}),
  }));

const serialiseComparison = (document, withReport = true) =>
  serialise(document, (comparison) => ({
    id: idOf(comparison),
    project: String(comparison.project?._id ?? comparison.project ?? ''),
    baselineSpec: specReference(comparison.baselineSpec),
    candidateSpec: specReference(comparison.candidateSpec),
    options: comparison.options || {},
    summary: comparison.summary || { total: 0, breaking: 0, potentiallyBreaking: 0, nonBreaking: 0 },
    resultDigest: comparison.resultDigest || '',
    createdAt: comparison.createdAt,
    ...(withReport ? { report: comparison.report } : {}),
  }));

const isObjectId = (value) => mongoose.isValidObjectId(value);

export const store = {
  users: {
    async create({ name, email, password }) {
      if (usingMongo()) {
        const created = await User.create({ name, email, password });
        return serialiseUser(created);
      }
      const user = {
        _id: nextId('usr'),
        name,
        email,
        password,
        createdAt: new Date(),
      };
      memory.users.push(user);
      return serialiseUser(user);
    },

    async findByEmail(email) {
      const value = String(email || '').toLowerCase();
      if (usingMongo()) {
        return serialiseUser(await User.findOne({ email: value }));
      }
      return serialiseUser(memory.users.find((user) => user.email === value));
    },

    async findById(id) {
      if (usingMongo()) {
        if (!isObjectId(id)) return null;
        return serialiseUser(await User.findById(id));
      }
      return serialiseUser(memory.users.find((user) => String(user._id) === String(id)));
    },
  },

  projects: {
    async create({ owner, name, description = '' }) {
      if (usingMongo()) {
        const created = await Project.create({ owner, name, description });
        return serialiseProject(created);
      }
      const project = {
        _id: nextId('prj'),
        owner,
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memory.projects.unshift(project);
      return serialiseProject(project);
    },

    async listByOwner(owner) {
      if (usingMongo()) {
        const rows = await Project.find({ owner }).sort({ updatedAt: -1 });
        return rows.map((row) => serialiseProject(row));
      }
      return memory.projects
        .filter((project) => String(project.owner) === String(owner))
        .map((project) => serialiseProject(project));
    },

    async findByIdForOwner(id, owner) {
      if (usingMongo()) {
        if (!isObjectId(id)) return null;
        const row = await Project.findOne({ _id: id, owner });
        return serialiseProject(row);
      }
      return serialiseProject(
        memory.projects.find(
          (project) => String(project._id) === String(id) && String(project.owner) === String(owner)
        )
      );
    },

    async remove(id) {
      if (usingMongo()) {
        if (!isObjectId(id)) return false;
        await Specification.deleteMany({ project: id });
        await Comparison.deleteMany({ project: id });
        const result = await Project.findByIdAndDelete(id);
        return Boolean(result);
      }
      memory.specifications = memory.specifications.filter((spec) => String(spec.project) !== String(id));
      memory.comparisons = memory.comparisons.filter((comparison) => String(comparison.project) !== String(id));
      const before = memory.projects.length;
      memory.projects = memory.projects.filter((project) => String(project._id) !== String(id));
      return memory.projects.length < before;
    },
  },

  specifications: {
    async replaceForRole({ project, role, name, version, openapi, operationCount, sizeBytes, document }) {
      if (usingMongo()) {
        if (!isObjectId(project)) return null;
        await Specification.deleteMany({ project, role });
        const created = await Specification.create({
          project,
          role,
          name,
          version,
          openapi,
          operationCount,
          sizeBytes,
          document,
        });
        return serialiseSpecification(created);
      }
      memory.specifications = memory.specifications.filter(
        (spec) => !(String(spec.project) === String(project) && spec.role === role)
      );
      const spec = {
        _id: nextId('spc'),
        project,
        role,
        name,
        version,
        openapi,
        operationCount,
        sizeBytes,
        document,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memory.specifications.push(spec);
      return serialiseSpecification(spec);
    },

    async listByProject(project) {
      if (usingMongo()) {
        if (!isObjectId(project)) return [];
        const rows = await Specification.find({ project }).sort({ role: 1 });
        return rows.map((row) => serialiseSpecification(row, false));
      }
      return memory.specifications
        .filter((spec) => String(spec.project) === String(project))
        .sort((a, b) => a.role.localeCompare(b.role))
        .map((spec) => serialiseSpecification(spec, false));
    },

    async findByRole(project, role) {
      if (usingMongo()) {
        if (!isObjectId(project)) return null;
        return serialiseSpecification(await Specification.findOne({ project, role }));
      }
      return serialiseSpecification(
        memory.specifications.find(
          (spec) => String(spec.project) === String(project) && spec.role === role
        )
      );
    },
  },

  comparisons: {
    async create({ project, owner, baselineSpec, candidateSpec, options, summary, resultDigest, report }) {
      if (usingMongo()) {
        const created = await Comparison.create({
          project,
          owner,
          baselineSpec,
          candidateSpec,
          options,
          summary,
          resultDigest,
          report,
        });
        return serialiseComparison(created, false);
      }
      const comparison = {
        _id: nextId('cmp'),
        project,
        owner,
        baselineSpec,
        candidateSpec,
        options,
        summary,
        resultDigest,
        report,
        createdAt: new Date(),
      };
      memory.comparisons.unshift(comparison);
      return serialiseComparison(comparison, false);
    },

    async listByProject(project, limit = 30) {
      if (usingMongo()) {
        if (!isObjectId(project)) return [];
        const rows = await Comparison.find({ project }).sort({ createdAt: -1 }).limit(limit);
        return rows.map((row) => serialiseComparison(row, false));
      }
      return memory.comparisons
        .filter((comparison) => String(comparison.project) === String(project))
        .slice(0, limit)
        .map((comparison) => serialiseComparison(comparison, false));
    },

    async findByIdForOwner(id, owner) {
      if (usingMongo()) {
        if (!isObjectId(id)) return null;
        const row = await Comparison.findOne({ _id: id, owner });
        return serialiseComparison(row);
      }
      return serialiseComparison(
        memory.comparisons.find(
          (comparison) =>
            String(comparison._id) === String(id) && String(comparison.owner) === String(owner)
        )
      );
    },

    async remove(id, owner) {
      if (usingMongo()) {
        if (!isObjectId(id)) return false;
        const result = await Comparison.findOneAndDelete({ _id: id, owner });
        return Boolean(result);
      }
      const before = memory.comparisons.length;
      memory.comparisons = memory.comparisons.filter(
        (comparison) =>
          !(String(comparison._id) === String(id) && String(comparison.owner) === String(owner))
      );
      return memory.comparisons.length < before;
    },
  },
};
