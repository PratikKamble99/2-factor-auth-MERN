import { HttpStatusCode } from "../../config/http.config";
import { ErrorCode } from "../enums/error-code.enum";

export class AppError extends Error {
  public statusCode: HttpStatusCode;
  public errorCode?: ErrorCode;

  constructor(
    public message: string,
    statusCode: HttpStatusCode,
    errorCode?: ErrorCode
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;

    Error.captureStackTrace(this, this.constructor);
  }
}
