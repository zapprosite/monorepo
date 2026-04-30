import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Lead } from './lead.entity';
import { Client } from './client.entity';
import { Schedule } from './schedule.entity';
import { Contract } from './contract.entity';
import { Reminder } from './reminder.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @OneToMany(() => User, (user) => user.team)
  users: User[];

  @OneToMany(() => Lead, (lead) => lead.team)
  leads: Lead[];

  @OneToMany(() => Client, (client) => client.team)
  clients: Client[];

  @OneToMany(() => Schedule, (schedule) => schedule.team)
  schedules: Schedule[];

  @OneToMany(() => Contract, (contract) => contract.team)
  contracts: Contract[];

  @OneToMany(() => Reminder, (reminder) => reminder.team)
  reminders: Reminder[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
