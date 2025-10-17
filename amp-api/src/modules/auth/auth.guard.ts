import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const cookieName = process.env.SESSION_COOKIE_NAME || 'amp_session';
    const token = req.cookies?.[cookieName];
    const user = this.auth.parseUserFromJwt(token);

    if (!user) return false;

    req.user = user;

    return true;
  }
}
