import serverless from 'serverless-http';
import { createApiApp } from '../../server/app.ts';

const app = createApiApp();
const baseHandler = serverless(app);

interface NetlifyEvent {
  path?: string;
  rawUrl?: string;
  [key: string]: unknown;
}

export const handler = async (event: NetlifyEvent, context: unknown) => {
  const normalizedEvent: NetlifyEvent = { ...event };
  const incomingPath = typeof normalizedEvent.path === 'string' ? normalizedEvent.path : '';

  if (incomingPath.startsWith('/.netlify/functions/api')) {
    const rest = incomingPath.slice('/.netlify/functions/api'.length);
    normalizedEvent.path = rest ? `/api${rest.startsWith('/') ? rest : `/${rest}`}` : '/api';
  } else if (incomingPath && !incomingPath.startsWith('/api')) {
    normalizedEvent.path = `/api${incomingPath.startsWith('/') ? incomingPath : `/${incomingPath}`}`;
  }

  if (
    typeof normalizedEvent.rawUrl === 'string' &&
    normalizedEvent.rawUrl.includes('/.netlify/functions/api')
  ) {
    normalizedEvent.rawUrl = normalizedEvent.rawUrl.replace('/.netlify/functions/api', '/api');
  }

  return baseHandler(normalizedEvent as never, context as never);
};
