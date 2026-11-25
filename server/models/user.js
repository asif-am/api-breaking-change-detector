import mongoose from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Adds username (email), hash and salt fields plus the hashing helpers.
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

export default mongoose.model('User', userSchema);
