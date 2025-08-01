import { Request } from "express";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../../common/utils/catch-errors";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import UserModel from "../../database/models/user.model";
import SessionModel from "../../database/models/session.model";
import {
  accessTokenSignOptions,
  refreshTokenSignOptions,
  signJwtToken,
} from "../../common/utils/jwt";

export class MfaService {
  public async generateMfaSetup(req: Request) {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException("Unauthorized user");
    }

    if (user.userPreference.enable2FA) {
      return {
        message: "MFA already enabled",
      };
    }

    let secretKey = user.userPreference.twoFactorSecrete;

    // If secret key is not present present the generate
    if (!secretKey) {
      const secret = speakeasy.generateSecret({
        name: "advanced-auth",
      });

      secretKey = secret.base32;
      user.userPreference.twoFactorSecrete = secretKey;
      await user.save();
    }

    const url = speakeasy.otpauthURL({
      secret: secretKey,
      label: `${user.email}`,
      issuer: "advanced-auth.com",
      encoding: "base32",
    });

    const qrCodeImageUrl = await qrcode.toDataURL(url);

    return {
      message: "Scan qrcode to or use setup key",
      secret: secretKey,
      qrcode: qrCodeImageUrl,
    };
  }

  public async verifyMfaSetup(req: Request, code: string, secretKey: string) {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException("Unauthorized user");
    }

    if (user.userPreference.enable2FA) {
      return {
        message: "MFA already enabled",
        userPreference: {
          enabled2FA: user.userPreference.enable2FA,
        },
      };
    }

    const isValid = speakeasy.totp.verify({
      secret: secretKey,
      token: code,
      encoding: "base32",
    });

    if (!isValid) {
      throw new BadRequestException("Invalid MFA code. Please try again.");
    }

    user.userPreference.enable2FA = true;
    await user.save();

    return {
      message: "MFA setup comleted successfully",
      userPreference: {
        enabled2FA: user.userPreference.enable2FA,
      },
    };
  }

  public async revokeMfa(req: Request) {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException("Unauthorized user");
    }

    if (!user.userPreference.enable2FA) {
      return {
        message: "MFA not enabled",
        userPreferences: {
          enable2FA: user.userPreference.enable2FA,
        },
      };
    }

    user.userPreference.twoFactorSecrete = undefined;
    user.userPreference.enable2FA = false;

    await user.save();

    return {
      message: "MFA revoke successfully",
      userPreferences: {
        enable2FA: user.userPreference.enable2FA,
      },
    };
  }

  public async verifyMFAForLogin(
    code: string,
    email: string,
    userAgent: string
  ) {
    const user = await UserModel.findOne({
      email,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (
      !user.userPreference.enable2FA &&
      !user.userPreference.twoFactorSecrete
    ) {
      throw new UnauthorizedException("MFA not enabled for this user");
    }

    const isValid = speakeasy.totp.verify({
      secret: user.userPreference.twoFactorSecrete!,
      encoding: "base32",
      token: code,
    });

    if (!isValid) {
      throw new UnauthorizedException("Invalid MFA code. Please try again");
    }

    const session = await SessionModel.create({
      userId: user._id,
      userAgent: userAgent,
    });

    const accessToken = signJwtToken(
      {
        userId: user._id,
        sessionId: session._id,
      },
      accessTokenSignOptions
    );

    const refreshToken = signJwtToken(
      {
        userId: user._id,
        sessionId: session._id,
      },
      refreshTokenSignOptions
    );

    return {
        user,
        accessToken,
        refreshToken
    }
  }
}
