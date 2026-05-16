import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  async notifyNewIdea(payload: { title: string; siteName: string; siteId: string; ideaId: string }) {
    const text = `New pitch brief: *${payload.title}* (${payload.siteName})`;
    const slackUrl = process.env.SLACK_WEBHOOK_URL?.trim();
    const hookUrl = process.env.NOTIFY_WEBHOOK_URL?.trim();

    const webhooks = [slackUrl, hookUrl].filter(Boolean) as string[];
    if (webhooks.length === 0) return;

    for (const url of webhooks) {
      try {
        const res = await fetch(url, {
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
        if (!res.ok) {
          this.logger.warn(`Webhook notify returned HTTP ${res.status} for URL ${url}`);
        } else {
          this.logger.debug(`Webhook notify succeeded for URL ${url}`);
        }
      } catch (e) {
        this.logger.warn(`Webhook notify failed for URL ${url}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
