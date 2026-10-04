import { describe } from 'vitest';

import { PROJECT, createMockApi } from '../mocks/nanoforge-api';
import { type ApiTarget, apiContract } from './api-contract';

/**
 * Runs the API contract. By default against the in-memory mock, so the mock and the contract
 * cannot drift apart. Against a real API with:
 *
 *   CONTRACT_API_URL=https://api.staging.nanoforge.eu \
 *   CONTRACT_API_KEY=… CONTRACT_ACCESS_TOKEN=… \
 *   [CONTRACT_FEATURES=settings] [CONTRACT_PROJECT_ID=…] [CONTRACT_REFRESH_TOKEN=…] \
 *   pnpm --filter @nanoforge-dev/editor-server-core test:contract
 */
const env = process.env;

const real = (): ApiTarget => ({
  baseUrl: env.CONTRACT_API_URL!,
  fetch: globalThis.fetch,
  apiKey: env.CONTRACT_API_KEY ?? '',
  accessToken: env.CONTRACT_ACCESS_TOKEN ?? '',
  refreshToken: env.CONTRACT_REFRESH_TOKEN,
  projectId: env.CONTRACT_PROJECT_ID,
  features: (env.CONTRACT_FEATURES ?? '').split(',').map((feature) => feature.trim()),
});

let mock: ApiTarget | undefined;
const mocked = (): ApiTarget =>
  (mock ??= {
    baseUrl: 'https://api.test',
    fetch: createMockApi().fetch,
    apiKey: 'test-key',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    projectId: PROJECT.id,
    features: ['settings'],
  });

describe(
  env.CONTRACT_API_URL ? `NanoForge API at ${env.CONTRACT_API_URL}` : 'NanoForge API (mock)',
  () => apiContract(env.CONTRACT_API_URL ? real : mocked),
);
