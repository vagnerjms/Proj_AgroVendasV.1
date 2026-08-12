import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.query['apiKey'];
    const validApiKey = process.env.API_KEY || 'AgroVendas_n8n_Secret_Key_2026';
    
    if (apiKey && apiKey === validApiKey) {
      request.user = { sub: 'system', email: 'system@agrovendas.local', role: 'admin' };
      return true;
    }
    
    return super.canActivate(context);
  }
}
