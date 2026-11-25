import mongoose from 'mongoose';

const specificationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['baseline', 'candidate'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    version: { type: String, default: '0.0.0' },
    openapi: { type: String, default: '' },
    operationCount: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    document: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

specificationSchema.index({ project: 1, role: 1 }, { unique: true });

export default mongoose.model('Specification', specificationSchema);
