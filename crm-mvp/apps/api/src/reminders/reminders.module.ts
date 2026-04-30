import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from '../entities/reminder.entity';
import { RemindersService } from './reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reminder])],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
