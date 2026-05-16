import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/api/v1`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
      logger.log(`Received ${signal} — shutting down gracefully`);
      await app.close();
      process.exit(0);
    });
  }
}

bootstrap().catch((err: unknown) => {
  logger.error(`Fatal bootstrap error: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);
  process.exit(1);
});
