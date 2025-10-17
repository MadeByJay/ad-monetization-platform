import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as JwtStrategyBase, ExtractJwt } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(JwtStrategyBase) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          const cookieName = process.env.SESSION_COOKIE_NAME || 'amp_session';
          return req?.cookies?.[cookieName];
        },
      ]),
      secretOrKey: process.env.JWT_SECRET || 'dev_secret',
    });
  }

  async validate(payload: any) {
    // attach to req.user
    return payload;
  }
}
