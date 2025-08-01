import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler";
import { SessionService } from "./session.service";
import { HTTPSTATUS } from "../../config/http.config";
import { NotFoundException } from "../../common/utils/catch-errors";

export class SessionController {
  constructor(private sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  // get All session in Desc(latest first) order
  public getAllSessions = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      const sessionId = req.sessionId;

      const sessions = await this.sessionService.getAllSessions(userId, sessionId);

      const modifiedSessions = sessions.map((session) => ({
        ...session.toObject(), // mongoose document converts it into a plain JavaScript object
        ...(sessionId == session.id && { isCurrrent: true }), // add new field in session if current session match
      }));

      return res.status(HTTPSTATUS.OK).json({
        message: "Rerived all  successfully",
        sessions: modifiedSessions,
      });
    }
  );

  // get current session
  public getSession = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const sessionId = req.sessionId;

      if (!sessionId) {
        throw new NotFoundException("Session ID not found. Please log in.");
      }

      const { user } = await this.sessionService.getSession(sessionId);

      return res.status(HTTPSTATUS.OK).json({
        message: "Session retrieved successfully",
        user,
      });
    }
  );

  // delete session
  public deleteSession = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const sessionId = req.params.id;
      const userId = req.user?.id;

      if (!sessionId) {
        throw new NotFoundException("Session ID not found. Please log in.");
      }

      await this.sessionService.deleteSession(sessionId, userId);

      return res.status(HTTPSTATUS.OK).json({
        messsage: "Session deleted successfully",
      });
    }
  );
}
