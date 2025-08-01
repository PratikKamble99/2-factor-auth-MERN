import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { MfaService } from "./mfa.service";
import { HTTPSTATUS } from "../../config/http.config";
import { OK } from "zod";
import {
  verifyMfaForLoginSchema,
  verifyMfaSchema,
} from "../../common/validators/mfa.validator";
import { setAuthenticationCookies } from "../../common/utils/cookie";

export class MfaController {
  constructor(private mfaService: MfaService) {
    this.mfaService = mfaService;
  }

  public generateMfaSetup = asyncHandler(
    async (req: Request, res: Response) => {
      const { message, qrcode, secret } =
        await this.mfaService.generateMfaSetup(req);

      return res.status(HTTPSTATUS.OK).json({
        message,
        qrcode,
        secret,
      });
    }
  );

  public verifyMfaSetup = asyncHandler(async (req: Request, res: Response) => {
    const { code, secretKey } = verifyMfaSchema.parse({
      ...req.body,
    });

    const { message, userPreference } = await this.mfaService.verifyMfaSetup(
      req,
      code,
      secretKey
    );

    return res.status(HTTPSTATUS.OK).json({
      message,
      userPreference,
    });
  });

  public revokeMfa = asyncHandler(async (req: Request, res: Response) => {
    const { message, userPreferences } = await this.mfaService.revokeMfa(req);

    return res.status(HTTPSTATUS.OK).json({
      message,
      userPreferences,
    });
  });

  public verifyMFAForLogin = asyncHandler(
    async (req: Request, res: Response) => {
      const { code, email, userAgent } = verifyMfaForLoginSchema.parse({
        ...req.body,
        userAgent: req.headers["user-agent"],
      });

      const { accessToken, refreshToken, user } =
        await this.mfaService.verifyMFAForLogin(code, email, userAgent!);

      return setAuthenticationCookies({ res, accessToken, refreshToken })
        .status(HTTPSTATUS.OK)
        .json({
          message: "Verified & login successfully",
          user,
        });
    }
  );
}
