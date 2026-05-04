import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  async notifyNewIdea(payload: { title: string; siteName: string; siteId: string; ideaId: string }) {
    const text = `New pitch brief: *${payload.title}* (${payload.siteName})`;
    const slackUrl = process.env.SLACK_WEBHOOK_URL?.trim();
    const hookUrl = process.env.NOTIFY_WEBHOOK_URL?.trim();

    for (const url of [slackUrl, hookUrl].filter(Boolean) as string[]) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            siteId: payload.siteId,
            ideaId: payload.ideaId,
            title: payload.title,
            siteName: payload.siteName,
          }),
        });
      } catch (e) {
        this.logger.warn(`Webhook notify failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
