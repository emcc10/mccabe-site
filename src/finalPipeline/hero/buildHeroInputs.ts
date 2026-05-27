import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';
import type { Mask } from '../../phase1/masks.js';
import type { SharedRenderContext } from '../shared/context.js';
import {
  heroInputBundleDir,
  heroPromptPath,
  heroProtectedMaskPath,
  heroReferenceBasePath,
  heroReferenceSwatchPath,
  heroInputSpecPath,
  heroUpholsteryMaskPath,
} from '../shared/paths.js';
import { buildHeroPrompt, formatHeroPromptFile } from './prompt.js';
import type { HeroInputBundle } from './spec.js';

async function writeMaskPng(path: string, mask: Mask, invert = false) {
  const buf = Buffer.alloc(mask.width * mask.height * 3);
  for (let i = 0; i < mask.data.length; i++) {
    const on = mask.data[i] >= 128;
    const v = invert ? (on ? 0 : 255) : on ? 255 : 0;
    const o = i * 3;
    buf[o] = v;
    buf[o + 1] = v;
    buf[o + 2] = v;
  }
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buf, { raw: { width: mask.width, height: mask.height, channels: 3 } })
    .png()
    .toFile(path);
}

function buildProtectedMask(
  alpha: Mask,
  upholstery: Mask,
  legs: Mask,
): Mask {
  const { width, height } = alpha;
  const data = new Uint8Array(width * height);
  for (let j = 0; j < data.length; j++) {
    const protect =
      alpha.data[j] < 128 || legs.data[j] >= 128 || upholstery.data[j] < 128;
    data[j] = protect ? 255 : 0;
  }
  return { data, width, height };
}

/**
 * Prepare generative edit bundle: masks, references, prompt, spec.
 * Does not call any external API.
 */
export async function buildHeroInputBundle(ctx: SharedRenderContext): Promise<HeroInputBundle> {
  const code = ctx.profile.code;
  const dir = heroInputBundleDir(code);
  mkdirSync(dir, { recursive: true });

  const upholsteryEditMask = ctx.upholstery;
  const protectedMask = buildProtectedMask(ctx.alpha, ctx.upholstery, ctx.legs);

  const paths = {
    bundleDir: dir,
    upholsteryEditMask: heroUpholsteryMaskPath(code),
    protectedMask: heroProtectedMaskPath(code),
    referenceBaseRecolor: heroReferenceBasePath(code),
    referenceCleanSwatch: heroReferenceSwatchPath(code),
    prompt: heroPromptPath(code),
    spec: heroInputSpecPath(code),
  };

  await writeMaskPng(paths.upholsteryEditMask, upholsteryEditMask);
  await writeMaskPng(paths.protectedMask, protectedMask);
  await sharp(ctx.base.path).png().toFile(paths.referenceBaseRecolor);
  await sharp(ctx.swatch.paths.cleanBase)
    .png()
    .toFile(paths.referenceCleanSwatch);

  const v = JSON.parse(readFileSync(ctx.swatch.paths.validationJson, 'utf8')) as { ok?: boolean };
  if (!v.ok) {
    throw new Error(
      `Clean swatch failed validation (${ctx.swatch.paths.validationJson}) — fix sanitization before hero run.`,
    );
  }

  const promptParts = buildHeroPrompt(ctx.profile);
  writeFileSync(paths.prompt, formatHeroPromptFile(promptParts));

  const spec = {
    pipeline: 'hero-pipeline-v1',
    swatchCode: code,
    profile: ctx.profile,
    editRegion: 'upholstery-only',
    protectedRegions: ['legs', 'feet', 'trim', 'background', 'alpha-outside'],
    references: {
      geometryAndLighting: paths.referenceBaseRecolor,
      materialCharacter: paths.referenceCleanSwatch,
    },
    masks: {
      editWhite: paths.upholsteryEditMask,
      protectWhite: paths.protectedMask,
    },
    prompt: promptParts,
    providerEnv: 'HERO_GENERATIVE_PROVIDER',
    notes: [
      'Generative step is optional; preview pipeline covers batch color previews.',
      'Composite hero output must re-lock legs/background from source after provider returns RGB.',
    ],
  };
  writeFileSync(paths.spec, JSON.stringify(spec, null, 2));

  return { paths, spec, promptParts };
}
