import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostgresService } from './postgres.service';

@Module({
  imports: [ConfigModule],
  providers: [PostgresService],
  exports: [PostgresService],
})
export class DatabaseModule {}
