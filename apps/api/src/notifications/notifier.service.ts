import { Injectable, Logger } from '@nestjs/common';

/** Returns a safe label for logging (env var name + hostname only, never the full URL). */
function redactWebhookUrl(url: string, envVarName: string): string {
  try {
    return `${envVarName}(${new URL(url).hostname})`;
  } catch {
    return envVarName;
  }
}

@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  async notifyNewIdea(payload: { title: string; siteName: string; siteId: string; ideaId: string }) {
    const text = `New pitch brief: *${payload.title}* (${payload.siteName})`;
    const slackUrl = process.env.SLACK_WEBHOOK_URL?.trim();
    const hookUrl = process.env.NOTIFY_WEBHOOK_URL?.trim();

    const webhooks: Array<{ url: string; label: string }> = [];
    if (slackUrl) webhooks.push({ url: slackUrl, label: redactWebhookUrl(slackUrl, 'SLACK_WEBHOOK_URL') });
    if (hookUrl) webhooks.push({ url: hookUrl, label: redactWebhookUrl(hookUrl, 'NOTIFY_WEBHOOK_URL') });
    if (webhooks.length === 0) return;

    for (const { url, label } of webhooks) {
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
          this.logger.warn(`Webhook notify returned HTTP ${res.status} for ${label}`);
        } else {
          this.logger.debug(`Webhook notify succeeded for ${label}`);
        }
      } catch (e) {
        this.logger.warn(`Webhook notify failed for ${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
