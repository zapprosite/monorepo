import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      relations: ['team'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['team'] });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(data: {
    name: string;
    email: string;
    password?: string;
    role?: string;
    teamId?: string;
  }): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email já cadastrado');

    const user = this.userRepo.create({
      name: data.name,
      email: data.email,
      password: data.password || null,
      role: (data.role as any) || 'user',
      teamId: data.teamId || null,
    });

    return this.userRepo.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    if (data.email && data.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: data.email } });
      if (existing) throw new ConflictException('Email já cadastrado');
    }
    Object.assign(user, data);
    return this.userRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }
}
