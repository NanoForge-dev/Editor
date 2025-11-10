import { HttpClient } from '../../utils/http-client';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { LoggerMiddleware } from './middlewares/logger.middleware';

export const client = new HttpClient(import.meta.env.VITE_API_BASE_URL).useMiddlewares(
  AuthMiddleware,
  LoggerMiddleware,
);
