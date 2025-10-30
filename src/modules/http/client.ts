import { HttpClient } from '../../utils/http-client';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { LoggerMiddleware } from './middlewares/logger.middleware';

export const client = new HttpClient('http://localhost:3000').useMiddlewares(
  AuthMiddleware,
  LoggerMiddleware,
);
