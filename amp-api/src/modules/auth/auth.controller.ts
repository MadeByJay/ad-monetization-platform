import { Body, Controller, Get, Post, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import type { RequestUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res() res: Response,
  ) {
    const session = await this.auth.validateUser(body.email, body.password);
    const token = this.auth.signSession(session);
    const cookieName = process.env.SESSION_COOKIE_NAME || 'amp_session';
    res.cookie(cookieName, token, this.auth.cookieOptions());
    res.json({ ok: true });
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'amp_session';
    res.clearCookie(cookieName, this.auth.cookieOptions());
    res.json({ ok: true });
  }

  @Get('me')
  async me(@Req() req: Request, @Res() res: Response) {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'amp_session';
    const token = req.cookies?.[cookieName];
    const user = this.auth.parseUserFromJwt(token);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    res.json({ user });
  }
}
