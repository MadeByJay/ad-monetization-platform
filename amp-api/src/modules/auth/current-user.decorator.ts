import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  user_id: string;
  email: string;
  account_id: string;
  role: 'owner' | 'admin' | 'sales' | 'trafficker' | 'analyst' | 'viewer';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser | null => {
    const request = context.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
