import mongoose, { Document, Schema } from "mongoose";
import { compareValue, hashValue } from "../../common/utils/bcrypt";
import { string } from "zod";

interface UserPreference {
  enable2FA: boolean;
  emailNotifications: boolean;
  twoFactorSecrete?: string;
}
export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  userPreference: UserPreference;
  comparePassword: (password: string) => Promise<boolean>;
}

const userPrefernces = new Schema<UserPreference>({
  enable2FA: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  twoFactorSecrete: { type: String, required: false },
});

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    userPreference: { type: userPrefernces, default: {} },
  },
  {
    timestamps: true,
    toJSON: {},
  }
);

userSchema.pre<UserDocument>("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await hashValue(this.password);
  }
  next();
});

userSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return await compareValue(password, this.password);
};

userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete (ret as any).password;
    delete (ret as any).userPreference?.twoFactorSecrete;
    return ret;
  },
});

const UserModel = mongoose.model<UserDocument>("User", userSchema);
export default UserModel;
