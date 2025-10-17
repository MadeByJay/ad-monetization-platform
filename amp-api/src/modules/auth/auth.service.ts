import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Repositories } from '../../repositories/repositories';
import type { RequestUser } from './current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly repositories: Repositories,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{
    user_id: string;
    account_id: string;
    role: string;
    email: string;
  }> {
    const user = await this.repositories.users.getByEmail(email);

    if (!user || !user.password_hash)
      throw new UnauthorizedException('invalid_credentials');

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) throw new UnauthorizedException('invalid_credentials');

    // pick default membership (first one) — single org model
    const memberships = await this.repositories.memberships.listByUser(user.id);
    const primary = memberships[0];

    if (!primary) throw new UnauthorizedException('no_membership');

    return {
      user_id: user.id,
      account_id: primary.account_id,
      role: primary.role as any,
      email: user.email,
    };
  }

  signSession(payload: {
    user_id: string;
    account_id: string;
    role: string;
    email: string;
  }) {
    return this.jwt.sign(payload);
  }

  cookieOptions() {
    const secure =
      (process.env.SESSION_COOKIE_SECURE ?? 'false').toLowerCase() === 'true';
    const domain = process.env.SESSION_COOKIE_DOMAIN || undefined;

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      domain,
      path: '/',
    };
  }

  parseUserFromJwt(token: string | null | undefined): RequestUser | null {
    if (!token) return null;

    try {
      const decoded = this.jwt.verify(token) as any;

      return {
        user_id: decoded.user_id,
        account_id: decoded.account_id,
        role: decoded.role,
        email: decoded.email,
      };
    } catch {
      return null;
    }
  }
}
