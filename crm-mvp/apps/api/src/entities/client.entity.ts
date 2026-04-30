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
import { Schedule } from './schedule.entity';
import { Contract } from './contract.entity';
import { Reminder } from './reminder.entity';

export type ClientType = 'pf' | 'pj';
export type ClientStatus = 'ativo' | 'inativo';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['pf', 'pj'],
    default: 'pf',
  })
  type: ClientType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  document: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({
    type: 'enum',
    enum: ['ativo', 'inativo'],
    default: 'ativo',
  })
  status: ClientStatus;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @OneToMany(() => Lead, (lead) => lead.convertedToClient)
  originatingLeads: Lead[];

  @OneToMany(() => Schedule, (schedule) => schedule.client)
  schedules: Schedule[];

  @OneToMany(() => Contract, (contract) => contract.client)
  contracts: Contract[];

  @OneToMany(() => Reminder, (reminder) => reminder.client)
  reminders: Reminder[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
