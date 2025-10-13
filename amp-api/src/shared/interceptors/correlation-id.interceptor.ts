import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res = http.getResponse();
    const id =
      req?.id || req?.headers?.['x-correlation-id'] || crypto.randomUUID();

    res.setHeader('x-correlation-id', id);

    return next.handle();
  }
}
