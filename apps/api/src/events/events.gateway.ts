import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    const orgId = client.handshake.query.orgId as string;
    if (orgId) client.join(`org:${orgId}`);
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('subscribe:site')
  handleSubscribeSite(client: Socket, siteId: string) {
    client.join(`site:${siteId}`);
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
