import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cnpj: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 7, default: '#39FF14' })
  primaryColor: string;

  @Column({ type: 'varchar', length: 7, default: '#0A0A0F' })
  secondaryColor: string;

  @Column({ type: 'text', nullable: true })
  responsibleSignature: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
