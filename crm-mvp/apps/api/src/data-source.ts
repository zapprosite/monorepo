import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Team } from './entities/team.entity';
import { Session } from './entities/session.entity';
import { Lead } from './entities/lead.entity';
import { Client } from './entities/client.entity';
import { Schedule } from './entities/schedule.entity';
import { Contract } from './entities/contract.entity';
import { Reminder } from './entities/reminder.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'crm',
  password: process.env.DB_PASSWORD || 'crm',
  database: process.env.DB_NAME || 'crm_mvp',
  entities: [User, Team, Session, Lead, Client, Schedule, Contract, Reminder],
  migrations: [__dirname + '/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
