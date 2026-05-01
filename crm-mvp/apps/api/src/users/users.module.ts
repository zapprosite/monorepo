import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Team])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
