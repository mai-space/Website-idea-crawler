import { CronExpressionParser } from 'cron-parser';

/** cron-parser v5 expects 6 fields (sec …); classic 5-field crons get a `0` second prefix. */
export function normalizeCronExpression(expr: string): string {
  const t = expr.trim();
  const n = t.split(/\s+/).length;
  if (n === 5) return `0 ${t}`;
  return t;
}

export function computeNextCrawlAt(cronExpr: string, from: Date): Date {
  const normalized = normalizeCronExpression(cronExpr);
  const interval = CronExpressionParser.parse(normalized, { currentDate: from });
  return interval.next().toDate();
}

export function isValidCronExpression(cronExpr: string): boolean {
  try {
    CronExpressionParser.parse(normalizeCronExpression(cronExpr), { currentDate: new Date() });
    return true;
  } catch {
    return false;
  }
}
