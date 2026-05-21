import type { RelativeLRemapParams } from '../phase4/recolor.js';

/** Locked Stage 4B — single render review, not final Bali Silk */

export const LOCKED_4B: RelativeLRemapParams & {
  stage: string;
  lockedFrom: string;
  notFinalBaliSilk: boolean;
} = {
  stage: '4B',
  lockedFrom: 'Stage 4 variant B',
  notFinalBaliSilk: true,
  lLow: 72,
  lHigh: 92,
  mappedLBlend: 0.82,
  targetA: 0.3,
  targetB: 4.2,
  chromaSourceA: 0.12,
  chromaSourceB: 0.1,
  chromaTargetA: 0.88,
  chromaTargetB: 0.9,
};
