/**
 * Material-class response: how texture patches blend with neutral master (sofa) luminance.
 * Texture extraction unchanged; only post-sample blending.
 */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function getMaterialClass(texture) {
  if (texture.isNamedLight) return 'light';
  if (texture.isDarkCool) return 'darkCool';
  return 'standard';
}

/** Per-class blend knobs (texture-patch pipeline; not flat LAB). */
export function getMaterialBlendProfile(texture) {
  switch (getMaterialClass(texture)) {
    case 'light':
      return {
        contrastRetain: 0.6,
        textureLBlend: 0.55,
        textureChromaBlend: 0.92,
        textureGrain: 0.5,
        shadowLift: 7.5,
        highlightBroaden: 0.4,
        creaseSuppress: 0.28,
      };
    case 'darkCool':
      return {
        contrastRetain: 0.7,
        textureLBlend: 0.58,
        textureChromaBlend: 0.94,
        textureGrain: 0.46,
        warmNeutralize: 0.4,
        shadowPullToTexture: 0.38,
        highlightCoolB: 3.5,
        highlightCoolA: 1.5,
      };
    default:
      return {
        contrastRetain: 0.76,
        textureLBlend: 0.44,
        textureChromaBlend: 0.88,
        textureGrain: 0.34,
      };
  }
}

/**
 * Blend swatch texture sample with sofa master L/a/b.
 * @param {number} masterL - neutral master L at pixel
 * @param {number} masterA - master a (usually ~0)
 * @param {number} masterB - master b (usually ~0)
 * @param {{ L: number, a: number, b: number }} texLab - sampled patch pixel LAB
 * @param {number} patchMeanL - patch median L for grain offset
 * @param {number} u - normalized sofa luminance 0..1 (shadow→highlight)
 * @param {object} profile - from getMaterialBlendProfile
 * @param {number} masterMeanL - masked mean L on sofa upholstery
 */
export function blendMaterialResponse(masterL, masterA, masterB, texLab, patchMeanL, u, profile, masterMeanL) {
  const {
    contrastRetain,
    textureLBlend,
    textureChromaBlend,
    textureGrain,
  } = profile;

  let structL = masterMeanL + (masterL - masterMeanL) * contrastRetain;

  if (profile.shadowLift != null) {
    const shadowW = (1 - u) * (1 - u);
    structL += profile.shadowLift * shadowW;
  }

  if (profile.highlightBroaden != null) {
    const hiW = smoothstep(0.6, 0.93, u);
    structL += (texLab.L - structL) * profile.highlightBroaden * hiW;
  }

  if (profile.creaseSuppress != null) {
    const creaseW = smoothstep(0.05, 0.38, 1 - u);
    structL += (texLab.L - structL) * profile.creaseSuppress * creaseW;
  }

  if (profile.warmNeutralize != null) {
    const warmW = smoothstep(0, 0.55, 1 - u) * profile.warmNeutralize;
    structL += (texLab.L - structL) * warmW;
  }

  if (profile.shadowPullToTexture != null) {
    const shW = smoothstep(0, 0.48, 1 - u) * profile.shadowPullToTexture;
    structL += (texLab.L - structL) * shW;
  }

  let baseL = structL * (1 - textureLBlend) + texLab.L * textureLBlend;
  const relL = texLab.L - patchMeanL;
  let finalL = baseL + relL * textureGrain;

  let a = masterA * (1 - textureChromaBlend) + texLab.a * textureChromaBlend;
  let b = masterB * (1 - textureChromaBlend) + texLab.b * textureChromaBlend;

  if (profile.highlightCoolB != null) {
    const coolW = smoothstep(0.52, 1, u);
    b -= profile.highlightCoolB * coolW;
    a -= profile.highlightCoolA * coolW;
  }

  return { L: finalL, a, b };
}
