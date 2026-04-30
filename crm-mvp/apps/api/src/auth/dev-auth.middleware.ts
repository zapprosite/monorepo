import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

export interface RequestWithUser extends Request {
  user?: { id: string; email: string; name: string };
}

@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    const devUserHeader = req.headers['x-dev-user'] as string;
    if (devUserHeader) {
      const user = await this.authService.validateDevUser(devUserHeader);
      if (user) {
        req.user = user;
      }
    }
    next();
  }
}
