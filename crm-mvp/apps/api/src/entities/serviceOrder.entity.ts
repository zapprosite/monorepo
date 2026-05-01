import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { Equipamento } from './equipamento.entity';
import { User } from './user.entity';
import { Team } from './team.entity';

export type ServiceOrderType =
  | 'instalacao'
  | 'manutencao'
  | 'reparo'
  | 'visita_tecnica'
  | 'emergencia';

export type ServiceOrderPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type ServiceOrderStatus =
  | 'orcamento'
  | 'aprovada'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada';

export interface ServiceOrderChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ServiceOrderPhoto {
  id: string;
  data: string; // base64
  caption: string;
  takenAt: string;
}

@Entity('service_orders')
export class ServiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Client | null;

  @Column({ type: 'uuid', nullable: true })
  equipamentoId: string | null;

  @ManyToOne(() => Equipamento, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'equipamentoId' })
  equipamento: Equipamento | null;

  @Column({ type: 'uuid', nullable: true })
  technicianId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'technicianId' })
  technician: User | null;

  @Column({
    type: 'enum',
    enum: ['instalacao', 'manutencao', 'reparo', 'visita_tecnica', 'emergencia'],
    default: "'manutencao'",
  })
  type: ServiceOrderType;

  @Column({
    type: 'enum',
    enum: ['baixa', 'media', 'alta', 'urgente'],
    default: "'media'",
  })
  priority: ServiceOrderPriority;

  @Column({
    type: 'enum',
    enum: ['orcamento', 'aprovada', 'em_andamento', 'concluida', 'cancelada'],
    default: "'orcamento'",
  })
  status: ServiceOrderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedDate: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cost: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Execution fields
  @Column({ type: 'jsonb', nullable: true })
  checklist: ServiceOrderChecklistItem[] | null;

  @Column({ type: 'jsonb', nullable: true })
  photos: ServiceOrderPhoto[] | null;

  @Column({ type: 'text', nullable: true })
  signature: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  executionStartedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
