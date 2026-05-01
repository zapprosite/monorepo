import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipamento } from '../entities/equipamento.entity';
import { EquipamentosService } from './equipamentos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Equipamento])],
  providers: [EquipamentosService],
  exports: [EquipamentosService],
})
export class EquipamentosModule {}
