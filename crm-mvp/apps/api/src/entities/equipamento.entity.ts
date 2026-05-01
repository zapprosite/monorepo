import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Team } from './team.entity';

export type EquipamentoType =
  | 'ar_condicionado'
  | 'refrigerador'
  | 'freezer'
  | 'split'
  | 'janela'
  | 'de_chao'
  | 'portatil'
  | 'outro';

export type EquipamentoStatus = 'ativo' | 'em_manutencao' | 'inativo';

@Entity('equipamentos')
export class Equipamento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber: string | null;

  @Column({
    type: 'enum',
    enum: ['ar_condicionado', 'refrigerador', 'freezer', 'split', 'janela', 'de_chao', 'portatil', 'outro'],
    default: 'ar_condicionado',
  })
  type: EquipamentoType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({
    type: 'varchar',
    length: 63,
    unique: true,
  })
  subdomain: string;

  @Column({
    type: 'enum',
    enum: ['ativo', 'em_manutencao', 'inativo'],
    default: 'ativo',
  })
  status: EquipamentoStatus;

  @Column({ type: 'date', nullable: true })
  installationDate: string | null;

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
