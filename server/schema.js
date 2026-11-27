import Joi from 'joi';

const email = Joi.string().trim().lowercase().email().required();
const password = Joi.string().min(6).max(72).required();

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  email,
  password,
});

export const loginSchema = Joi.object({
  email,
  password,
});

export const forgotPasswordSchema = Joi.object({
  email,
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().length(64).hex().required(),
  password,
});

export const projectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().trim().allow('').max(400).default(''),
});

export const uploadSpecificationSchema = Joi.object({
  role: Joi.string().valid('baseline', 'candidate').required(),
  name: Joi.string().trim().max(120).allow(''),
});

export const validationRequestSchema = Joi.object({
  specification: Joi.any().required(),
  label: Joi.string().trim().max(80).default('Specification'),
});

export const compareSchema = Joi.object({
  baseline: Joi.any().required(),
  candidate: Joi.any().required(),
  options: Joi.alternatives().try(Joi.object(), Joi.string().allow('')).default({}),
});

/** The stored specifications are the inputs, so a project run only sends options. */
export const projectComparisonSchema = Joi.object({
  options: Joi.alternatives().try(Joi.object(), Joi.string().allow('')).default({}),
});

/**
 * Comparison options arrive as an object from JSON requests and as a JSON string
 * from multipart uploads. Anything unparseable falls back to the defaults.
 */
export function parseOptions(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
