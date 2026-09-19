import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-do-not-use-in-prod';

// Fail fast rather than boot with a publicly-guessable signing key. The demo
// value below is the historical default shipped in .env.example — never allow
// it (or a short/missing secret) outside local development.
const KNOWN_INSECURE_SECRETS = new Set([
  'super-secret-jwt-key-facilityflow-12345',
  'dev-insecure-do-not-use-in-prod',
  'change-me',
  'secret',
]);
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && (!JWT_SECRET || JWT_SECRET.length < 32 || KNOWN_INSECURE_SECRETS.has(JWT_SECRET))) {
  throw new Error(
    'Refusing to start: JWT_SECRET is missing, too short (<32 chars), or a known insecure default. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
  );
}

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '30m') as any },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}