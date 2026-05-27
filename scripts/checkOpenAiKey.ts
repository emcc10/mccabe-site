import { loadEnvLocal } from './loadEnvLocal.js';
import { sanitizeApiKey, verifyOpenAiApiKey } from '../src/finalPipeline/hero/providers/openaiImageEdit.js';

loadEnvLocal();

const key =
  sanitizeApiKey(process.env.OPENAI_API_KEY) ||
  sanitizeApiKey(process.env.HERO_GENERATIVE_API_KEY);

if (!key) {
  console.error('[hero:check-key] No key found. Set OPENAI_API_KEY or add .env.local');
  process.exitCode = 1;
} else {
  console.log(`[hero:check-key] Key present: ${key.length} chars, prefix ${key.slice(0, 12)}...`);
}

verifyOpenAiApiKey()
  .then(() => console.log('[hero:check-key] OpenAI accepted the key.'))
  .catch((err) => {
    console.error('[hero:check-key] Failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
