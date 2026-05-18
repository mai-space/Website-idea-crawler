import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    const token = (client.handshake.auth as Record<string, unknown>)?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Client ${client.id} connected without a JWT token — disconnecting`);
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      });
    } catch (err: unknown) {
      this.logger.warn(`Client ${client.id} provided an invalid JWT token — disconnecting: ${err instanceof Error ? err.message : String(err)}`);
      client.disconnect(true);
      return;
    }

    const orgId = payload.orgId;
    client.data.orgId = orgId;
    client.join(`org:${orgId}`);
    this.logger.debug(`Client ${client.id} authenticated and joined org:${orgId}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe:site')
  async handleSubscribeSite(client: Socket, siteId: string) {
    if (!siteId) {
      this.logger.warn(`Client ${client.id} tried to subscribe to a site without providing siteId`);
      return;
    }

    const orgId = client.data.orgId as string | undefined;
    if (!orgId) {
      this.logger.warn(`Client ${client.id} tried to subscribe to site ${siteId} without authenticated orgId — ignoring`);
      return;
    }

    const site = await this.prisma.site.findFirst({
      where: { id: siteId, orgId },
      select: { id: true },
    });

    if (!site) {
      this.logger.warn(`Client ${client.id} (org ${orgId}) attempted to subscribe to unauthorized site ${siteId}`);
      return;
    }

    client.join(`site:${siteId}`);
    this.logger.debug(`Client ${client.id} subscribed to site:${siteId}`);
  }

  emitJobUpdate(orgId: string, payload: { jobId: string; siteId: string; status: string; progress: number }) {
    this.server.to(`org:${orgId}`).emit('job.update', payload);
  }

  emitCrawlPage(orgId: string, payload: { siteId: string; url: string; pageType: string }) {
    this.server.to(`org:${orgId}`).emit('crawl.page', payload);
  }

  emitQueueStats(orgId: string, payload: { crawl: number; parse: number; ideas: number; workers: number }) {
    this.server.to(`org:${orgId}`).emit('queue.stats', payload);
  }

  emitError(orgId: string, payload: { siteId: string; type: string; message: string; retryable: boolean }) {
    this.logger.warn(`Emitting error event to org ${orgId}: [${payload.type}] ${payload.message} (retryable=${payload.retryable})`);
    this.server.to(`org:${orgId}`).emit('error.new', payload);
  }

  emitIdeaNew(orgId: string, payload: { ideaId: string; siteId: string; title: string }) {
    this.server.to(`org:${orgId}`).emit('idea.new', payload);
    this.server.to(`site:${payload.siteId}`).emit('idea.new', payload);
  }

  emitIdeaUpdated(
    orgId: string,
    payload: { ideaId: string; siteId: string; status?: string; customHours?: number | null },
  ) {
    this.server.to(`org:${orgId}`).emit('idea.updated', payload);
    this.server.to(`site:${payload.siteId}`).emit('idea.updated', payload);
  }
}
