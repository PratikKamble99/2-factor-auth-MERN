import UserModel from "../../database/models/user.model";
import SessionModel from "../../database/models/session.model";
import VerificationCodeModel from "../../database/models/verification.model";

import { SignOptions } from "jsonwebtoken";
import {
  LoginRequest,
  RegisterRequest,
  ResetPasswordData,
} from "../../common/interface/auth.interface";
import {
  anHourFromNow,
  calculateExpirationDate,
  fortyFiveMinutesFromNow,
  ONE_DAY_IN_MS,
  threeMinutesAgo,
} from "../../common/utils/date-time";
import {
  BadRequestException,
  HttpException,
  InternalServerException,
  NotFoundException,
  UnauthorizedException,
} from "../../common/utils/catch-errors";
import { VerificationEnum } from "../../common/enums/verification-code.enum";
import { ErrorCode } from "../../common/enums/error-code.enum";
import { config } from "../../config/app.config";
import {
  accessTokenSignOptions,
  refreshTokenSignOptions,
  RefreshTPayload,
  signJwtToken,
  verifyJwtToken,
} from "../../common/utils/jwt";
import {
  passwordResetTemplate,
  verifyEmailTemplate,
} from "../../mailers/templates/template";
import { HTTPSTATUS } from "../../config/http.config";
import { sendmail } from "../../mailers/mailer";
import { hashValue } from "../../common/utils/bcrypt";

export class AuthService {
  public register = async (registerData: RegisterRequest) => {
    const { name, email, password } = registerData;

    const existUser = await UserModel.exists({ email });

    if (existUser) {
      throw new BadRequestException(
        "User already exists",
        ErrorCode.AUTH_EMAIL_ALREADY_EXISTS
      );
    }

    const newUser = await UserModel.create({
      name,
      email,
      password,
    });

    const userId = newUser._id;

    const verificationCode = await VerificationCodeModel.create({
      userId,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: fortyFiveMinutesFromNow(),
    });

    // Here you would typically send the verification code to the user's email

    const confirmationUrl = `${config.CLIENT_PATH}/confirm-account?code=${verificationCode.code}`;

    await sendmail({
      to: newUser.email,
      ...verifyEmailTemplate(confirmationUrl),
    });

    return {
      user: newUser,
    };
  };

  public login = async (loginData: LoginRequest) => {
    const { email, password, userAgent } = loginData;

    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND
      );
    }

    // Check if user enabled 2FA return user = null
    if (user.userPreference.enable2FA) {
      return {
        user: null,
        mfaRequired: true,
        accessToken: "",
        refreshToken: "",
      };
    }

    const session = await SessionModel.create({
      userId: user._id,
      userAgent,
    });

    const accessToken = signJwtToken(
      {
        userId: user._id,
        sessionId: session._id,
      },
      {
        secret: config.JWT.SECRET,
        audience: ["user"],
        expiresIn: config.JWT.EXPIRES_IN as SignOptions["expiresIn"],
      }
    );

    const refreshToken = signJwtToken(
      {
        sessionId: session._id,
      },
      {
        secret: config.JWT.REFRESH_SECRET,
        audience: ["user"],
        expiresIn: config.JWT.REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
      }
    );

    return {
      accessToken,
      refreshToken,
      user,
      mfaRequired: false, // Assuming 2FA is not implemented yet
    };
  };

  public refreshToken = async (refreshToken: string) => {
    const { payload } = verifyJwtToken<RefreshTPayload>(refreshToken, {
      secret: config.JWT.REFRESH_SECRET,
      audience: "user",
    });

    if (!payload) {
      throw new UnauthorizedException(
        "Invalid refresh token",
        ErrorCode.AUTH_INVALID_TOKEN
      );
    }

    const session = await SessionModel.findById(payload.sessionId);
    const now = Date.now();

    if (!session) {
      throw new UnauthorizedException(
        "Session not found",
        ErrorCode.AUTH_UNAUTHORIZED_ACCESS
      );
    }

    if (session.expiredAt.getTime() <= now) {
      throw new UnauthorizedException(
        "Refresh token has expired",
        ErrorCode.AUTH_INVALID_TOKEN
      );
    }

    // If the session is older than 1 day, we can consider it for refresh
    const sessionRequiresRefresh =
      session.expiredAt.getTime() - now <= ONE_DAY_IN_MS;

    if (sessionRequiresRefresh) {
      session.expiredAt = calculateExpirationDate(
        config.JWT.REFRESH_EXPIRES_IN
      );

      await session.save();
    }

    const newRefreshToken = sessionRequiresRefresh
      ? signJwtToken(
          {
            sessionId: session._id,
          },
          refreshTokenSignOptions
        )
      : undefined;

    const newAccessToken = signJwtToken(
      {
        userId: session.userId,
        sessionId: session._id,
      },
      accessTokenSignOptions
    );

    return {
      accessToken: newAccessToken,
      newRefreshToken,
    };
  };

  public verifyEmail = async (code: string) => {
    const validCode = await VerificationCodeModel.findOne({
      code,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: { $gt: new Date() },
    });

    if (!validCode) {
      throw new BadRequestException("Invalid or expired verification code");
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      validCode.userId,
      {
        isEmailVerified: true,
      },
      {
        new: true,
      }
    );

    if (!updatedUser) {
      throw new BadRequestException(
        "Unable to verify email",
        ErrorCode.VALIDATION_ERROR
      );
    }

    await validCode.deleteOne();

    return {
      user: updatedUser,
    };

    // If the code is valid, you can proceed with the email verification logic
  };

  public forgotPassword = async (email: string) => {
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new NotFoundException(
        "User not found with this email",
        ErrorCode.AUTH_NOT_FOUND
      );
    }

    // Rate limit for max 2 email send within 3 mins
    const timeAgo = threeMinutesAgo();

    const maxAttempts = 2;

    const emailsCount = await VerificationCodeModel.countDocuments({
      userId: user._id,
      type: VerificationEnum.PASSWORD_RESET,
      expiresAt: { $gt: timeAgo },
    });

    if (maxAttempts <= emailsCount) {
      throw new HttpException(
        "Too many request, try again later",
        HTTPSTATUS.TOO_MANY_REQUESTS,
        ErrorCode.AUTH_TOO_MANY_ATTEMPTS
      );
    }

    const newCodeExpiration = anHourFromNow();

    const verificationCode = await VerificationCodeModel.create({
      userId: user._id,
      type: VerificationEnum.PASSWORD_RESET,
      expiresAt: newCodeExpiration,
    });

    const resetPasswordUrl = `${config.CLIENT_PATH}/reset-password?code=${verificationCode.code}&exp=${newCodeExpiration.getTime()}`;

    const { data, error } = await sendmail({
      to: user.email,
      ...passwordResetTemplate(resetPasswordUrl),
    });

    if (!data?.id) {
      throw new InternalServerException(`${error?.name} ${error?.message}`);
    }

    return {
      resetLink: resetPasswordUrl,
      emailId: data.id,
    };
  };

  public resetPassword = async ({
    password,
    verificationCode,
  }: ResetPasswordData) => {
    const code = await VerificationCodeModel.findOne({
      code: verificationCode,
      type: VerificationEnum.PASSWORD_RESET,
      expiresAt: { $gt: Date.now() },
    });

    if (!code) {
      throw new NotFoundException("Invalid or expired verification code");
    }

    const hashedPassword = await hashValue(password);

    const updatedUser = await UserModel.findByIdAndUpdate(code.userId, {
      password: hashedPassword,
    });

    if (!updatedUser) {
      throw new BadRequestException("Failed to reset password!");
    }

    await code.deleteOne();

    await SessionModel.deleteMany({
      userId: updatedUser._id,
    });

    return {
      user: updatedUser,
    };
  };

  public logout = async (sessionId: string) => {
    await SessionModel.findByIdAndDelete(sessionId);
  };
}
