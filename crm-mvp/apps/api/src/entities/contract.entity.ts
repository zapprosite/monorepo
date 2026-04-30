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

export type ContractType = 'comercial' | 'manutencao' | 'residencial';
export type ContractFrequency = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type ContractStatus = 'rascunho' | 'ativo' | 'suspenso' | 'encerrado' | 'cancelado';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.contracts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({
    type: 'enum',
    enum: ['comercial', 'manutencao', 'residencial'],
  })
  type: ContractType;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  value: number;

  @Column({
    type: 'enum',
    enum: ['mensal', 'trimestral', 'semestral', 'anual'],
  })
  frequency: ContractFrequency;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({
    type: 'enum',
    enum: ['rascunho', 'ativo', 'suspenso', 'encerrado', 'cancelado'],
    default: 'rascunho',
  })
  status: ContractStatus;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
