import { IsEmail, IsIn, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

const STRONG_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: STRONG_PASSWORD_MESSAGE })
  @Matches(/[a-z]/, { message: STRONG_PASSWORD_MESSAGE })
  @Matches(/[0-9]/, { message: STRONG_PASSWORD_MESSAGE })
  @Matches(/[^A-Za-z0-9]/, { message: STRONG_PASSWORD_MESSAGE })
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsIn(['HIRING_ORG', 'PROVIDER'])
  role: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: STRONG_PASSWORD_MESSAGE })
  @Matches(/[a-z]/, { message: STRONG_PASSWORD_MESSAGE })
  @Matches(/[0-9]/, { message: STRONG_PASSWORD_MESSAGE })
  @Matches(/[^A-Za-z0-9]/, { message: STRONG_PASSWORD_MESSAGE })
  password: string;
}