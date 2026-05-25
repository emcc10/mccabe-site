export function buildRealLeatherLockedParams() {
  return {
    productCode: 'TEST-SOFA',
    swatch: 'BALI-SILK',
    lockedVersion: 'REALLEATHER-FINAL-A',
    frozenAt: new Date().toISOString().slice(0, 10),
    productionBaseline: true,
    baselineImageRole: 'Locked current best RealLeather output',
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
    nextStep: 'Apply the same RealLeather Reference Match method to the next leather swatch. Only create a new phase if the next swatch exposes a specific failure.',
  };
}
