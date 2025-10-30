import { client } from '../client';
import { ComponentStorageRepository } from './repository/repositories/component-storage.repository';

export const api = {
  componentStorage: new ComponentStorageRepository(client),
};
