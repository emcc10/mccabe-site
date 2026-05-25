export function buildRealLeatherLockedParams() {
  return {
    productCode: 'TEST-SOFA',
    swatch: 'BALI-SILK',
    lockedVersion: 'REALLEATHER-FINAL-A',
    frozenAt: new Date().toISOString().slice(0, 10),
    productionBaseline: false,
    checkpointOnly: true,
    baselineImageRole: 'Checkpoint / revert point only; not production-ready',
    regenerateScript: 'npm run export:realleather-locked',
    sourceRenderScript: 'npm run render:phaseRealLeatherFinal',
    lockedFrom: 'phaseRealLeatherFinal-variant-A.png',
    method: {
      name: 'RealLeather Reference Match',
      base: 'REALLEATHER-REF2-B',
      canonicalOutput: 'REALLEATHER-FINAL-A',
      direction: [
        'smooth tonal/material transforms only',
        'reference-derived leather behavior',
        'no texture transfer',
        'no visible grain',
        'no mottle',
        'no detail-phase branch',
      ],
    },
    preserve: [
      'overall tone from REF2-B / FINAL-A',
      'seam depth',
      'cushion separation',
      'smooth catalog finish',
      'neutral-warm Bali Silk color',
    ],
    doNotContinueTuning: [
      'texture transfer',
      'Detail phases',
      'mottle',
      'visible grain',
      'micro smoothing',
      'brightness/shadow tweaks',
    ],
    nextStep: 'Keep this as a checkpoint only. The next step is stronger reference-guided relighting, not another minor polish pass.',
  };
}
