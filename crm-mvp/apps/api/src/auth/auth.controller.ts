import { Controller, Get, Post, Req, Res, UseGuards, Body, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Response } from 'express';

function setAuthCookie(res: Response, token: string) {
  res.cookie('crm_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const token = await this.authService.login(req.user);
    const redirectUrl = process.env.WEB_URL || 'http://localhost:3080';
    setAuthCookie(res, token);
    res.redirect(`${redirectUrl}/dashboard`);
  }

  @Post('login')
  async localLogin(@Body() body: { email: string; password: string }, @Res() res: Response) {
    const result = await this.authService.loginLocal(body.email, body.password);
    if (!result) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }
    setAuthCookie(res, result.token);
    res.json({ authenticated: true, user: result.user });
  }

  @Get('me')
  async getMe(@Req() req: any) {
    const token = req.cookies?.crm_token || req.headers?.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };
    return this.authService.validateToken(token);
  }

  @Get('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('crm_token');
    res.json({ ok: true });
  }
}
