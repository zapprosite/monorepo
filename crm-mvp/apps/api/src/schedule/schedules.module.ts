import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../entities/schedule.entity';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule])],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
