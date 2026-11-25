import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/app.ts';

const app = createApiApp();

export default function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse,
) {
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      const rewrittenPath = parsed.searchParams.get('__path');
      if (rewrittenPath !== null) {
        parsed.searchParams.delete('__path');
        const qs = parsed.searchParams.toString();
        const sub = rewrittenPath.replace(/^\/+/, '');
        req.url = sub ? `/api/${sub}${qs ? `?${qs}` : ''}` : `/api${qs ? `?${qs}` : ''}`;
      }
    } catch {
      // Keep original req.url if URL parsing fails
    }
  }
  return app(req as never, res as never);
}
