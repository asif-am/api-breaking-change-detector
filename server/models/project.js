import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [80, 'Project name must be at most 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [400, 'Description must be at most 400 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
