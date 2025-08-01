import "dotenv/config";
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config/app.config";
import connectDB from "./database/database";
import errorHandler from "./middlewares/errorHandler";
import { HTTPSTATUS } from "./config/http.config";
import { asyncHandler } from "./middlewares/asyncHandler";
import { BadRequestException } from "./common/utils/catch-errors";
import authRoutes from "./modules/auth/auth.routes";
import passport from "./middlewares/passport";
import sessionRoutes from "./modules/session/session.routes";
import mfaRoutes from "./modules/mfa/mfa.routes";

const app = express();
const BASE_PATH = config.BASE_PATH;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: config.CLIENT_PATH,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(passport.initialize());

app.get(
  "",
  asyncHandler(async (req: Request, res: Response) => {
    res
      .status(HTTPSTATUS.OK)
      .json({ message: `Welcome to the API! Base path is ${BASE_PATH}` });
  })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/session`, sessionRoutes);
app.use(`${BASE_PATH}/mfa`, mfaRoutes);

app.use(errorHandler);

// app.listen(config.PORT, async () => {
//   console.log(`Server is running on ${config.APP_ORIGIN}:${config.PORT}`);
//   await connectDB();
// });

connectDB();

export default app;
