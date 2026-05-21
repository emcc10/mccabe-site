/**
 * Mandatory 6-panel Bali debug strip.
 */
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import sharp from 'sharp';

/**
 * @param {Buffer[]} panels — [source, previous, new, contourAlpha, detail, seam]
 */
export async function writeBaliDebugStrip6(panels, width, height, channels, outPath) {
  const count = panels.length;
  const stripW = width * count;
  const strip = Buffer.alloc(stripW * height * channels);
  for (let y = 0; y < height; y++) {
    for (let col = 0; col < count; col++) {
      const panel = panels[col];
      for (let x = 0; x < width; x++) {
        const sj = y * width + x;
        const dj = y * stripW + col * width + x;
        const sp = sj * channels;
        const dp = dj * channels;
        strip[dp] = panel[sp];
        strip[dp + 1] = panel[sp + 1];
        strip[dp + 2] = panel[sp + 2];
        if (channels === 4) strip[dp + 3] = panel[sp + 3] ?? 255;
      }
    }
  }
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(strip, { raw: { width: stripW, height, channels } }).png().toFile(outPath);
  return outPath;
}

/** @deprecated use writeBaliDebugStrip6 */
export async function writeBaliDebugStrip(panels, width, height, channels, outPath) {
  return writeBaliDebugStrip6(panels, width, height, channels, outPath);
}

export async function writeBaliDebugStripN(panels, width, height, channels, outPath) {
  return writeBaliDebugStrip6(panels, width, height, channels, outPath);
}

function patchBoundingBox(patchMask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (patchMask[y * width + x] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) return null;
  const pad = 4;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function extractRightLegCrop(buf, patchMask, width, height, channels) {
  const bb = patchBoundingBox(patchMask, width, height);
  if (!bb) return null;
  const crop = Buffer.alloc(bb.width * bb.height * channels);
  for (let y = 0; y < bb.height; y++) {
    for (let x = 0; x < bb.width; x++) {
      const sj = (bb.top + y) * width + (bb.left + x);
      const dj = y * bb.width + x;
      const sp = sj * channels;
      const dp = dj * channels;
      crop[dp] = buf[sp];
      crop[dp + 1] = buf[sp + 1];
      crop[dp + 2] = buf[sp + 2];
      if (channels === 4) crop[dp + 3] = buf[sp + 3] ?? 255;
    }
  }
  return { crop, bb };
}

/** Upscale crop to full panel width (letterbox) for debug strip columns. */
export async function upscaleCropToPanel(crop, cropW, cropH, channels, panelW, panelH) {
  const panel = Buffer.alloc(panelW * panelH * channels);
  panel.fill(255);
  const scale = Math.min(panelW / cropW, panelH / cropH);
  const dw = Math.round(cropW * scale);
  const dh = Math.round(cropH * scale);
  const ox = Math.floor((panelW - dw) / 2);
  const oy = Math.floor((panelH - dh) / 2);
  const resized = await sharp(crop, { raw: { width: cropW, height: cropH, channels } })
    .resize(dw, dh, { kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer();
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sp = (y * dw + x) * channels;
      const dp = ((oy + y) * panelW + (ox + x)) * channels;
      panel[dp] = resized[sp];
      panel[dp + 1] = resized[sp + 1];
      panel[dp + 2] = resized[sp + 2];
    }
  }
  return panel;
}

/** Zoom crop of right-leg patch region (default 400%). */
export async function writeRightLegZoomCrop(buf, patchMask, width, height, channels, outPath, zoom = 4) {
  const bb = patchBoundingBox(patchMask, width, height);
  if (!bb) return null;
  const crop = Buffer.alloc(bb.width * bb.height * channels);
  for (let y = 0; y < bb.height; y++) {
    for (let x = 0; x < bb.width; x++) {
      const sj = (bb.top + y) * width + (bb.left + x);
      const dj = y * bb.width + x;
      const sp = sj * channels;
      const dp = dj * channels;
      crop[dp] = buf[sp];
      crop[dp + 1] = buf[sp + 1];
      crop[dp + 2] = buf[sp + 2];
      if (channels === 4) crop[dp + 3] = buf[sp + 3] ?? 255;
    }
  }
  const zw = bb.width * zoom;
  const zh = bb.height * zoom;
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(crop, { raw: { width: bb.width, height: bb.height, channels } })
    .resize(zw, zh, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(outPath);
  return outPath;
}

/**
 * Contour + material debug strip (10 panels) + right-leg zoom.
 */
export async function writeBaliDebugContourPack(
  panels,
  width,
  height,
  channels,
  basePath,
  patchMask,
  finalComposite,
  zoom = 4,
) {
  const stripPath = basePath.replace(/\.png$/i, '-contour-strip-10panel.png');
  const stripPanels = panels.slice(0, 9);
  const overrideCrop = extractRightLegCrop(panels[5] ?? finalComposite, patchMask, width, height, channels);
  if (overrideCrop) {
    stripPanels[5] = await upscaleCropToPanel(
      overrideCrop.crop,
      overrideCrop.bb.width,
      overrideCrop.bb.height,
      channels,
      width,
      height,
    );
  }
  const finalCrop = extractRightLegCrop(finalComposite, patchMask, width, height, channels);
  if (finalCrop) {
    stripPanels.push(
      await upscaleCropToPanel(finalCrop.crop, finalCrop.bb.width, finalCrop.bb.height, channels, width, height),
    );
  } else {
    stripPanels.push(panels[9] ?? panels[2] ?? panels[0]);
  }
  await writeBaliDebugStripN(stripPanels, width, height, channels, stripPath);
  const zoomBase = basePath.replace(/\.png$/i, '');
  const zoomFinal = await writeRightLegZoomCrop(
    finalComposite,
    patchMask,
    width,
    height,
    channels,
    `${zoomBase}-right-leg-final-${zoom}x.png`,
    zoom,
  );
  return { stripPath, zoomFinal };
}

/**
 * Material-variation debug strip (10 panels) + right-leg 3x zoom.
 */
export async function writeBaliDebugMaterialPack(
  panels,
  width,
  height,
  channels,
  basePath,
  patchMask,
  finalComposite,
) {
  const stripPath = basePath.replace(/\.png$/i, '-material-strip-10panel.png');
  const stripPanels = panels.slice(0, 9);
  const finalCrop = extractRightLegCrop(finalComposite, patchMask, width, height, channels);
  if (finalCrop) {
    stripPanels.push(
      await upscaleCropToPanel(finalCrop.crop, finalCrop.bb.width, finalCrop.bb.height, channels, width, height),
    );
  } else {
    stripPanels.push(panels[9] ?? panels[1]);
  }
  await writeBaliDebugStripN(stripPanels, width, height, channels, stripPath);
  const zoomBase = basePath.replace(/\.png$/i, '');
  const zoomFinal = await writeRightLegZoomCrop(
    finalComposite,
    patchMask,
    width,
    height,
    channels,
    `${zoomBase}-right-leg-final-3x.png`,
    3,
  );
  return { stripPath, zoomFinal };
}

/**
 * Mandatory matte debug pack (10 exports).
 */
export async function writeBaliDebugMattePack(
  panels,
  width,
  height,
  channels,
  basePath,
  patchMask,
  zoomPanels,
) {
  const stripPath = basePath.replace(/\.png$/i, '-matte-strip-10panel.png');
  const stripPanels = panels.slice(0, 8);
  const beforeCrop = extractRightLegCrop(zoomPanels.alphaBefore, patchMask, width, height, channels);
  const finalCrop = extractRightLegCrop(zoomPanels.finalComposite, patchMask, width, height, channels);
  if (beforeCrop) {
    stripPanels.push(
      await upscaleCropToPanel(beforeCrop.crop, beforeCrop.bb.width, beforeCrop.bb.height, channels, width, height),
    );
  } else {
    stripPanels.push(panels[8] ?? panels[0]);
  }
  if (finalCrop) {
    stripPanels.push(
      await upscaleCropToPanel(finalCrop.crop, finalCrop.bb.width, finalCrop.bb.height, channels, width, height),
    );
  } else {
    stripPanels.push(panels[9] ?? panels[1]);
  }
  await writeBaliDebugStripN(stripPanels, width, height, channels, stripPath);
  const zoomBase = basePath.replace(/\.png$/i, '');
  const z1 = await writeRightLegZoomCrop(
    zoomPanels.alphaBefore,
    patchMask,
    width,
    height,
    channels,
    `${zoomBase}-right-leg-alpha-before-3x.png`,
  );
  const z2 = await writeRightLegZoomCrop(
    zoomPanels.finalComposite,
    patchMask,
    width,
    height,
    channels,
    `${zoomBase}-right-leg-final-3x.png`,
  );
  return { stripPath, zoomAlphaBefore: z1, zoomFinal: z2 };
}
