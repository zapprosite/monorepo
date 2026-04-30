import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';
import { Team } from './team.entity';

export type ScheduleType = 'instalacao' | 'manutencao' | 'visita_tecnica' | 'emergencia';
export type ScheduleStatus = 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'timestamptz' })
  dateTime: Date;

  @Column({
    type: 'enum',
    enum: ['instalacao', 'manutencao', 'visita_tecnica', 'emergencia'],
  })
  type: ScheduleType;

  @Column({ type: 'uuid', nullable: true })
  technicianId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'technicianId' })
  technician: User | null;

  @Column({
    type: 'enum',
    enum: ['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado'],
    default: 'agendado',
  })
  status: ScheduleStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
