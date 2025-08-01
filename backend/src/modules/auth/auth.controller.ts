import { HTTPSTATUS } from "./../../config/http.config";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { AuthService } from "./auth.service";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verificationEmailSchema,
} from "../../common/validators/auth.validator";
import {
  clearAuthenticationCookies,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  setAuthenticationCookies,
} from "../../common/utils/cookie";
import { ErrorCode } from "../../common/enums/error-code.enum";
import {
  NotFoundException,
  UnauthorizedException,
} from "../../common/utils/catch-errors";
import { NextFunction, Request, Response } from "express";

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  public register = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      // return this.authService.register(req, res, next);

      const body = registerSchema.parse(req.body);
      console.log("Parsed body:", body);

      const { user } = await this.authService.register(body);
      return res
        .status(201)
        .json({ message: "User registered successfully", user });
    }
  );

  public login = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const userAgent = req.headers["user-agent"];
      const body = loginSchema.parse({ ...req.body, userAgent });

      const { accessToken, refreshToken, user, mfaRequired } =
        await this.authService.login(body);


        if(mfaRequired){
          return res.status(HTTPSTATUS.OK).json({
            message:"Verify MFA authentication",
            mfaRequired,
            user
          })
        }

      return setAuthenticationCookies({ res, accessToken, refreshToken })
        .status(HTTPSTATUS.OK)
        .json({ message: "User logged in successfully", user, mfaRequired });
    }
  );

  public refresh = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const refreshToken = req.cookies.refreshToken as string | undefined;

      if (!refreshToken) {
        throw new UnauthorizedException(
          "Refresh token is missing",
          ErrorCode.AUTH_TOKEN_NOT_FOUND
        );
      }

      const { accessToken, newRefreshToken } =
        await this.authService.refreshToken(refreshToken);

      if (newRefreshToken) {
        return res.cookie(
          "refreshToken",
          newRefreshToken,
          getRefreshTokenCookieOptions()
        );
      }

      return res
        .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
        .status(HTTPSTATUS.OK)
        .json({ message: "Tokens refreshed successfully" });
    }
  );

  public verifyEmail = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { code } = verificationEmailSchema.parse(req.body);

      await this.authService.verifyEmail(code);

      return res
        .status(HTTPSTATUS.OK)
        .json({ message: "Email verified succesfully" });
    }
  );

  public forgotPassword = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      const email = emailSchema.parse(req.body.email);

      await this.authService.forgotPassword(email);

      res.status(HTTPSTATUS.OK).json({
        message: "PAssword reset email sent",
      });
    }
  );

  public resetPassword = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      const body = resetPasswordSchema.parse(req.body);

      await this.authService.resetPassword(body);

      return clearAuthenticationCookies(res).status(HTTPSTATUS.OK).json({
        message: "Reset Password successfully",
      });
    }
  );

  public logOut = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<any> => {
      const sessionId = req.sessionId;
      console.log(sessionId)
      if (!sessionId) {
        throw new NotFoundException("Session not found");
      }

      await this.authService.logout(sessionId);

      return clearAuthenticationCookies(res).status(HTTPSTATUS.OK).json({
        message: "User logout succesfully"
      })

    }
  );
}
