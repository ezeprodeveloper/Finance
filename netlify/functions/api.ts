import serverless from 'serverless-http';
import { createApiApp } from '../../server/app.ts';

const app = createApiApp();
const baseHandler = serverless(app);

export const handler = async (event: unknown, context: unknown) => {
  return baseHandler(event as never, context as never);
};
