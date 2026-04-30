import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Team } from './team.entity';
import { Lead } from './lead.entity';
import { Client } from './client.entity';
import { Schedule } from './schedule.entity';
import { Contract } from './contract.entity';
import { Reminder } from './reminder.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, (team) => team.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @OneToMany(() => Lead, (lead) => lead.responsible)
  leads: Lead[];

  @OneToMany(() => Schedule, (schedule) => schedule.technician)
  schedules: Schedule[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
