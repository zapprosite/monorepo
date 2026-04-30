import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { Team } from './team.entity';

export type ReminderType = 'ligacao' | 'email' | 'visita' | 'renovacao';
export type ReminderStatus = 'pendente' | 'concluido' | 'cancelado';

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({
    type: 'enum',
    enum: ['ligacao', 'email', 'visita', 'renovacao'],
  })
  type: ReminderType;

  @Column({ type: 'timestamptz' })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: ['pendente', 'concluido', 'cancelado'],
    default: 'pendente',
  })
  status: ReminderStatus;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
