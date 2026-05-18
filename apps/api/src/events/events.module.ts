import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

const modulLogger = new Logger('EventsModule');

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          modulLogger.warn('JWT_SECRET is not set — using insecure default; set it in production');
        }
        return { secret: secret || 'dev-secret-change-in-production' };
      },
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
