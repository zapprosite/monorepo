import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class AuthService {
  private readonly devUsers: Record<string, User> = {
    'dev@crm.local': {
      id: 'dev-001',
      email: 'dev@crm.local',
      name: 'Dev User',
    },
  };

  async validateDevUser(email: string): Promise<User | null> {
    return this.devUsers[email] || null;
  }

  async getSessionInfo(userId: string): Promise<User | null> {
    return Object.values(this.devUsers).find(u => u.id === userId) || null;
  }
}
