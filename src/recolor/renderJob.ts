import type { RenderRequest, RenderResult } from './types.js';
import { renderProductSwatch } from './pipeline.js';

export async function runRenderJob(request: RenderRequest): Promise<RenderResult> {
  return renderProductSwatch(request);
}
