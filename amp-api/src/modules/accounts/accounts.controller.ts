import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';

@Controller('accounts')
@UseGuards(JwtCookieAuthGuard)
export class AccountsController {
  /**
   * Stubbed invite endpoint. Generates a fake invite link token.
   * In a real implementation, persist to invitations table and email the link.
   */
  @Post('invite')
  async invite(
    @Body()
    body: {
      email: string;
      role?: 'owner' | 'admin' | 'sales' | 'trafficker' | 'analyst' | 'viewer';
    },
    @CurrentUser() user: RequestUser | null,
  ) {
    if (!user) throw new BadRequestException('unauthorized');
    if (!body?.email) throw new BadRequestException('missing_email');

    const token = crypto.randomUUID();
    const url = process.env.PUBLIC_APP_URL ?? 'http://localhost:4310'
    const inviteLink = `${url}/auth/login?invite=${token}`;

    // NOTE: Not persisted; just a stub so product can be demoed end-to-end.
    return {
      ok: true,
      account_id: user.account_id,
      email: body.email,
      role: body.role ?? 'viewer',
      invite_token: token,
      invite_link: inviteLink,
      message:
        'Invitation stub generated. In production this would be emailed.',
    };
  }
}
