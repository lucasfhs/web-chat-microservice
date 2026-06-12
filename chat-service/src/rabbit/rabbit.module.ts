import { Global, Module } from '@nestjs/common';
import { RabbitPublisher } from './rabbit.publisher';

@Global()
@Module({
  providers: [RabbitPublisher],
  exports: [RabbitPublisher],
})
export class RabbitModule {}
