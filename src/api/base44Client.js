import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createBase44MemoryClient, isBase44MockEnabled } from '@/testing/qa2/base44MemoryClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = isBase44MockEnabled() ? createBase44MemoryClient({
  persistKey: 'cafeplan-qa2-base44-memory',
}) : createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
