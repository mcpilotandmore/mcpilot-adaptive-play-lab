import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), '..');
const server = process.env.COMFYUI_URL ?? 'http://127.0.0.1:8190';
const outputDir = resolve(root, 'public', 'hazards');
const sourceDir = resolve(root, 'work', 'hazard-generation');

const sharedPrompt = [
  'premium sci-fi arcade game hazard sprite',
  'single isolated object',
  'orthographic front view',
  'centered and fully visible with generous empty margin',
  'crisp unmistakable silhouette readable at icon size',
  'high-end hard-surface 3D game art',
  'obsidian metal with luminous danger-red, hot coral, and ultraviolet energy',
  'sharp emissive rim lighting',
  'pure solid black background edge to edge',
  'no ground plane and no cast shadow',
].join(', ');

const negativePrompt = [
  'words',
  'letters',
  'numbers',
  'typography',
  'logo',
  'watermark',
  'frame',
  'border',
  'interface',
  'multiple objects',
  'duplicate',
  'environment',
  'landscape',
  'floor',
  'pedestal',
  'cast shadow',
  'gray background',
  'white background',
  'gradient background',
  'cropped',
  'cut off',
  'blurry',
  'low contrast',
  'cute',
  'cartoon',
].join(', ');

const hazards = Object.freeze([
  Object.freeze({
    slug: 'rift-spire',
    name: 'Rift Spire',
    seed: 913071,
    width: 768,
    height: 1152,
    outputWidth: 420,
    outputHeight: 700,
    prompt: 'a tall split monolith pierced by a vertical white-hot dimensional fracture, asymmetric jagged crown, spear-like profile',
  }),
  Object.freeze({
    slug: 'pulse-mine',
    name: 'Pulse Mine',
    seed: 913113,
    width: 1152,
    height: 768,
    outputWidth: 700,
    outputHeight: 420,
    prompt: 'a squat orbital proximity mine, one blazing circular reactor eye, six uneven armored radial fins, broad aggressive profile',
  }),
  Object.freeze({
    slug: 'static-thorn',
    name: 'Static Thorn',
    seed: 913229,
    width: 768,
    height: 1152,
    outputWidth: 420,
    outputHeight: 700,
    prompt: 'a skeletal open-frame vertical tripwire pylon with large negative-space gaps, two offset hooked arms, exposed coils around a thin crackling ultraviolet energy spine, crooked thorn silhouette, asymmetrical, not a solid pillar, not a crystal, not an obelisk',
  }),
]);

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const fetchJson = async (path, options) => {
  const response = await fetch(`${server}${path}`, options);
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  return response.json();
};

const makeWorkflow = ({ checkpoint, spec }) => ({
  1: {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: checkpoint },
  },
  2: {
    class_type: 'CLIPTextEncode',
    inputs: { text: `${sharedPrompt}, ${spec.prompt}`, clip: ['1', 1] },
  },
  3: {
    class_type: 'CLIPTextEncode',
    inputs: { text: negativePrompt, clip: ['1', 1] },
  },
  4: {
    class_type: 'EmptyLatentImage',
    inputs: { width: spec.width, height: spec.height, batch_size: 1 },
  },
  5: {
    class_type: 'KSampler',
    inputs: {
      seed: spec.seed,
      steps: 34,
      cfg: 6.5,
      sampler_name: 'dpmpp_2m_sde',
      scheduler: 'karras',
      denoise: 1,
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['4', 0],
    },
  },
  6: {
    class_type: 'VAEDecode',
    inputs: { samples: ['5', 0], vae: ['1', 2] },
  },
  7: {
    class_type: 'SaveImage',
    inputs: { filename_prefix: `second-player-hazards/${spec.slug}`, images: ['6', 0] },
  },
});

const waitForImage = async (promptId) => {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    const history = await fetchJson(`/history/${encodeURIComponent(promptId)}`);
    const record = history[promptId];
    if (record?.status?.status_str === 'error') {
      throw new Error(`ComfyUI failed prompt ${promptId}: ${JSON.stringify(record.status.messages)}`);
    }
    const image = record?.outputs?.['7']?.images?.[0];
    if (image) return image;
    await sleep(750);
  }
  throw new Error(`Timed out waiting for ComfyUI prompt ${promptId}`);
};

const extractNeonAlpha = async (source, spec) => {
  const decoded = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc((decoded.info.width * decoded.info.height) * 4);

  for (let sourceOffset = 0, outputOffset = 0; sourceOffset < decoded.data.length; sourceOffset += 3, outputOffset += 4) {
    const red = decoded.data[sourceOffset];
    const green = decoded.data[sourceOffset + 1];
    const blue = decoded.data[sourceOffset + 2];
    const brightest = Math.max(red, green, blue);
    const alpha = Math.max(0, Math.min(255, Math.round(((brightest - 5) / 42) * 255)));
    rgba[outputOffset] = red;
    rgba[outputOffset + 1] = green;
    rgba[outputOffset + 2] = blue;
    rgba[outputOffset + 3] = alpha;
  }

  return sharp(rgba, {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize(spec.outputWidth, spec.outputHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
};

const main = async () => {
  const systemStats = await fetchJson('/system_stats');
  const checkpoints = await fetchJson('/models/checkpoints');
  const checkpoint = checkpoints.find((name) => name === 'juggernautXL_ragnarokBy.safetensors') ?? checkpoints[0];
  if (!checkpoint) throw new Error('ComfyUI has no checkpoint available');

  await mkdir(outputDir, { recursive: true });
  await mkdir(sourceDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: `ComfyUI ${systemStats.system?.comfyui_version ?? 'unknown'}`,
    checkpoint,
    server,
    assets: [],
  };

  for (const spec of hazards) {
    process.stdout.write(`Generating ${spec.name}...\n`);
    const queued = await fetchJson('/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: 'second-player-hazard-pipeline',
        prompt: makeWorkflow({ checkpoint, spec }),
      }),
    });
    const image = await waitForImage(queued.prompt_id);
    const query = new URLSearchParams({
      filename: image.filename,
      subfolder: image.subfolder ?? '',
      type: image.type ?? 'output',
    });
    const sourceResponse = await fetch(`${server}/view?${query}`);
    if (!sourceResponse.ok) throw new Error(`Could not download ${spec.name}: ${sourceResponse.status}`);
    const source = Buffer.from(await sourceResponse.arrayBuffer());
    const sourcePath = resolve(sourceDir, `${spec.slug}-source.png`);
    const assetPath = resolve(outputDir, `${spec.slug}.webp`);
    await writeFile(sourcePath, source);
    await writeFile(assetPath, await extractNeonAlpha(source, spec));
    manifest.assets.push({
      slug: spec.slug,
      name: spec.name,
      path: `public/hazards/${spec.slug}.webp`,
      seed: spec.seed,
      sourceSize: `${spec.width}x${spec.height}`,
      outputSize: `${spec.outputWidth}x${spec.outputHeight}`,
      prompt: `${sharedPrompt}, ${spec.prompt}`,
      negativePrompt,
      promptId: queued.prompt_id,
    });
  }

  await writeFile(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Wrote ${manifest.assets.length} hazard assets to ${outputDir}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
