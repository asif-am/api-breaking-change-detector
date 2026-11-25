import mongoose from 'mongoose';

const referenceSchema = new mongoose.Schema(
  {
    specId: { type: String, default: '' },
    name: { type: String, default: '' },
    version: { type: String, default: '' },
  },
  { _id: false }
);

const comparisonSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    baselineSpec: { type: referenceSchema, required: true },
    candidateSpec: { type: referenceSchema, required: true },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary: {
      total: { type: Number, default: 0 },
      breaking: { type: Number, default: 0 },
      potentiallyBreaking: { type: Number, default: 0 },
      nonBreaking: { type: Number, default: 0 },
    },
    resultDigest: { type: String, default: '' },
    report: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Comparison', comparisonSchema);
