import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';

// Simple JWT using Node crypto
import { createHmac } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-mvp-dev-secret-change-in-production';

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function signToken(payload: object): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 }));
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new UnauthorizedException('Invalid token');
  const expectedSig = createHmac('sha256', JWT_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');
  if (parts[2] !== expectedSig) throw new UnauthorizedException('Invalid token signature');
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }
    return payload;
  } catch {
    throw new UnauthorizedException('Invalid token');
  }
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
  ) {}

  async validateGoogleUser(googleUser: { email: string; name: string; avatar: string | null }): Promise<User> {
    let user = await this.userRepo.findOne({ where: { email: googleUser.email }, relations: ['team'] });
    if (!user) {
      // Create default team if none exists
      let team = await this.teamRepo.findOne({ where: { name: 'Default' } });
      if (!team) {
        team = this.teamRepo.create({ name: 'Default', description: 'Default team' });
        team = await this.teamRepo.save(team);
      }
      user = this.userRepo.create({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.avatar,
        teamId: team.id,
      });
      user = await this.userRepo.save(user);
    }
    return user;
  }

  async login(googleUser: { email: string; name: string; avatar: string | null }): Promise<string> {
    const user = await this.validateGoogleUser(googleUser);
    return signToken({ sub: user.id, email: user.email, name: user.name });
  }

  async validateToken(token: string): Promise<{ authenticated: boolean; user?: any }> {
    try {
      const payload = verifyToken(token);
      const user = await this.userRepo.findOne({ where: { id: payload.sub }, relations: ['team'] });
      if (!user) return { authenticated: false };
      return { authenticated: true, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, teamId: user.teamId } };
    } catch {
      return { authenticated: false };
    }
  }

  async loginLocal(email: string, password: string): Promise<{ token: string; user: any } | null> {
    const adminEmail = process.env.ADMIN_EMAIL || 'zappro.ia@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || '';

    if (email !== adminEmail || password !== adminPassword) {
      return null;
    }

    let user = await this.userRepo.findOne({ where: { email }, relations: ['team'] });
    if (!user) {
      let team = await this.teamRepo.findOne({ where: { name: 'Admin' } });
      if (!team) {
        team = this.teamRepo.create({ name: 'Admin', description: 'Administradores', slug: 'admin' });
        team = await this.teamRepo.save(team);
      }
      user = this.userRepo.create({
        email,
        name: 'Administrador',
        avatar: null,
        teamId: team.id,
      });
      user = await this.userRepo.save(user);
    }

    const token = signToken({ sub: user.id, email: user.email, name: user.name });
    return { token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, teamId: user.teamId } };
  }

  async getSessionInfo(userId: string): Promise<any | null> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['team'] });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, avatar: user.avatar, teamId: user.teamId };
  }
}
