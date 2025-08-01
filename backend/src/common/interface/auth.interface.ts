export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  userAgent?: string;
}

export interface ResetPasswordData {
  password: string;
  verificationCode: string;
}
