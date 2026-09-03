import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { isReleaseManifestObject, validatePackRelease } from './submission-data.mjs';
import { renderSubmissionFiles, validateSrt } from './submission-render.mjs';

const root = process.cwd();

export const REQUIRED_MEDIA_REQUIREMENTS = Object.freeze({
  videoWidth: 1920,
  videoHeight: 1080,
  minimumDurationSeconds: 118,
  maximumDurationSeconds: 179.5,
  minimumFrameRate: 24,
  maximumFrameRate: 60,
  minimumAudioSampleRate: 44100,
  minimumThumbnailWidth: 1280,
  minimumThumbnailHeight: 720,
  minimumGalleryWidth: 1280,
  minimumGalleryHeight: 720,
  targetIntegratedLufsMinimum: -18,
  targetIntegratedLufsMaximum: -12,
  maximumTruePeakDbfs: -1,
});

export function validateMediaRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
    return ['requirements must be an object containing the locked production contract'];
  }
  const errors = [];
  for (const [key, requiredValue] of Object.entries(REQUIRED_MEDIA_REQUIREMENTS)) {
    if (requirements[key] !== requiredValue) {
      errors.push(`requirements.${key} must remain ${requiredValue}`);
    }
  }
  const unexpected = Object.keys(requirements)
    .filter((key) => !(key in REQUIRED_MEDIA_REQUIREMENTS));
  if (unexpected.length) errors.push(`requirements contains unexpected keys: ${unexpected.join(', ')}`);
  return errors;
}

const rational = (value) => {
  const [numerator, denominator] = String(value ?? '').split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

export function validateVideoProbe(probe, requirements) {
  const errors = [];
  const warnings = [];
  const duration = Number(probe?.format?.duration);
  const video = probe?.streams?.find((stream) => stream.codec_type === 'video');
  const audio = probe?.streams?.find((stream) => stream.codec_type === 'audio');

  if (!Number.isFinite(duration)) errors.push('Video duration could not be read');
  else {
    if (duration < requirements.minimumDurationSeconds) {
      errors.push(`Video is ${duration.toFixed(3)}s; minimum production runtime is ${requirements.minimumDurationSeconds}s`);
    }
    if (duration > requirements.maximumDurationSeconds) {
      errors.push(`Video is ${duration.toFixed(3)}s; it must remain below ${requirements.maximumDurationSeconds}s`);
    }
    if (duration < 118 || duration > 125) warnings.push('Video is outside the preferred 1:58–2:05 edit window');
  }

  if (!video) errors.push('Video stream is missing');
  else {
    if (video.codec_name !== 'h264') errors.push(`Video codec must be h264, received ${video.codec_name ?? 'unknown'}`);
    if (video.width !== requirements.videoWidth || video.height !== requirements.videoHeight) {
      errors.push(`Video must be ${requirements.videoWidth}x${requirements.videoHeight}, received ${video.width ?? '?'}x${video.height ?? '?'}`);
    }
    if (video.pix_fmt !== 'yuv420p') errors.push(`Video pixel format must be yuv420p, received ${video.pix_fmt ?? 'unknown'}`);
    const frameRate = rational(video.avg_frame_rate || video.r_frame_rate);
    if (frameRate === null
        || frameRate < requirements.minimumFrameRate
        || frameRate > requirements.maximumFrameRate) {
      errors.push(`Video frame rate must be ${requirements.minimumFrameRate}–${requirements.maximumFrameRate} fps`);
    }
  }

  if (!audio) errors.push('Audio stream is missing');
  else {
    if (audio.codec_name !== 'aac') errors.push(`Audio codec must be aac, received ${audio.codec_name ?? 'unknown'}`);
    const sampleRate = Number(audio.sample_rate);
    if (!Number.isFinite(sampleRate) || sampleRate < requirements.minimumAudioSampleRate) {
      errors.push(`Audio sample rate must be at least ${requirements.minimumAudioSampleRate} Hz`);
    }
    if (!Number.isInteger(audio.channels) || audio.channels < 1) errors.push('Audio channel count is invalid');
  }

  return { errors, warnings, duration };
}

export function validateImageMetadata(metadata, label, minimumWidth, minimumHeight) {
  const errors = [];
  if (!['png', 'jpeg', 'webp'].includes(metadata?.format)) {
    errors.push(`${label} must be PNG, JPEG, or WebP`);
  }
  if (!Number.isInteger(metadata?.width) || !Number.isInteger(metadata?.height)) {
    errors.push(`${label} dimensions could not be read`);
    return errors;
  }
  if (metadata.width < minimumWidth || metadata.height < minimumHeight) {
    errors.push(`${label} must be at least ${minimumWidth}x${minimumHeight}, received ${metadata.width}x${metadata.height}`);
  }
  const aspect = metadata.width / metadata.height;
  if (Math.abs(aspect - (16 / 9)) > 0.01) {
    errors.push(`${label} must use a 16:9 frame, received ${metadata.width}x${metadata.height}`);
  }
  return errors;
}

export function parseLoudnessOutput(value) {
  const integratedMatches = [...String(value).matchAll(/\bI:\s*(-?inf|-?\d+(?:\.\d+)?)\s+LUFS/gi)];
  const peakMatches = [...String(value).matchAll(/\bPeak:\s*(-?inf|-?\d+(?:\.\d+)?)\s+dBFS/gi)];
  const toNumber = (raw) => /^-?inf$/i.test(raw) ? Number.NEGATIVE_INFINITY : Number(raw);
  return {
    integratedLufs: integratedMatches.length ? toNumber(integratedMatches.at(-1)[1]) : null,
    truePeakDbfs: peakMatches.length ? toNumber(peakMatches.at(-1)[1]) : null,
  };
}

export function validateManifestRuntime(actualDuration, manifestDuration, tolerance = 0.5) {
  if (!Number.isFinite(actualDuration) || !Number.isFinite(manifestDuration)) return [];
  return Math.abs(actualDuration - manifestDuration) <= tolerance
    ? []
    : [`Video duration ${actualDuration.toFixed(3)}s does not match manifest runtime ${manifestDuration}s within ${tolerance}s`];
}

const safeMediaPath = (raw, label, errors) => {
  if (typeof raw !== 'string' || !raw.trim() || isAbsolute(raw)) {
    errors.push(`${label} must be a workspace-relative path`);
    return null;
  }
  const absolute = resolve(root, raw);
  const fromRoot = relative(root, absolute);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    errors.push(`${label} escapes the workspace`);
    return null;
  }
  return absolute;
};

const probeVideo = (path) => {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,r_frame_rate,sample_rate,channels',
    '-of', 'json', path,
  ], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'ffprobe failed');
  return JSON.parse(result.stdout);
};

const measureLoudness = (path) => {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', '-i', path,
    '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-',
  ], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  if (result.status !== 0) throw new Error('FFmpeg loudness analysis failed');
  return parseLoudnessOutput(result.stderr);
};

export async function checkMediaFiles({
  configPath = resolve(root, 'submission.media.json'),
  releasePath = resolve(root, 'submission.release.json'),
} = {}) {
  const errors = [];
  const warnings = [];
  let config;
  let release;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    return { errors: [`Could not read submission.media.json: ${error.message}`], warnings };
  }
  try {
    release = JSON.parse(readFileSync(releasePath, 'utf8'));
  } catch (error) {
    return { errors: [`Could not read submission.release.json: ${error.message}`], warnings };
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push('submission.media.json must contain an object');
    config = {};
  }
  if (config.schemaVersion !== 1) errors.push('submission.media.json schemaVersion must be 1');
  errors.push(...validateMediaRequirements(config.requirements));
  const requirements = REQUIRED_MEDIA_REQUIREMENTS;

  let rendered = { errors: [], files: new Map() };
  if (!isReleaseManifestObject(release)) {
    errors.push('submission.release.json must contain an object');
    release = {};
  } else {
    const validation = validatePackRelease(release, { allowPreview: false });
    errors.push(...validation.errors.map((error) => `Release manifest: ${error}`));
    if (!validation.errors.length) {
      rendered = renderSubmissionFiles(release);
      errors.push(...rendered.errors.map((error) => `Release render: ${error}`));
    }
  }

  if (!Array.isArray(config.galleryPaths) || config.galleryPaths.length !== 3) {
    errors.push('galleryPaths must contain exactly three images');
  } else if (new Set(config.galleryPaths).size !== config.galleryPaths.length) {
    errors.push('galleryPaths must be unique');
  }

  const videoPath = safeMediaPath(config.videoPath, 'videoPath', errors);
  const captionsPath = safeMediaPath(config.captionsPath, 'captionsPath', errors);
  const thumbnailPath = safeMediaPath(config.thumbnailPath, 'thumbnailPath', errors);
  const galleryPaths = Array.isArray(config.galleryPaths)
    ? config.galleryPaths.map((path, index) => safeMediaPath(path, `galleryPaths[${index}]`, errors))
    : [];

  let duration;
  if (videoPath && !existsSync(videoPath)) errors.push(`Missing final video: ${config.videoPath}`);
  else if (videoPath) {
    try {
      const validation = validateVideoProbe(probeVideo(videoPath), requirements);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
      duration = validation.duration;
      const manifestRuntime = release.artifacts?.videoRuntimeSeconds;
      errors.push(...validateManifestRuntime(duration, manifestRuntime));
      const loudness = measureLoudness(videoPath);
      if (!Number.isFinite(loudness.integratedLufs)) errors.push('Integrated loudness could not be measured or the audio is silent');
      else if (loudness.integratedLufs < requirements.targetIntegratedLufsMinimum
          || loudness.integratedLufs > requirements.targetIntegratedLufsMaximum) {
        errors.push(`Integrated loudness must be ${requirements.targetIntegratedLufsMinimum} to ${requirements.targetIntegratedLufsMaximum} LUFS, received ${loudness.integratedLufs} LUFS`);
      }
      if (!Number.isFinite(loudness.truePeakDbfs)) errors.push('True peak could not be measured');
      else if (loudness.truePeakDbfs > requirements.maximumTruePeakDbfs) {
        errors.push(`True peak must remain at or below ${requirements.maximumTruePeakDbfs} dBFS, received ${loudness.truePeakDbfs} dBFS`);
      }
    } catch (error) {
      errors.push(`Could not inspect final video: ${error.message}`);
    }
  }

  if (captionsPath && !existsSync(captionsPath)) errors.push(`Missing final captions: ${config.captionsPath}`);
  else if (captionsPath) {
    const captions = readFileSync(captionsPath, 'utf8').replace(/\r\n?/g, '\n');
    errors.push(...validateSrt(captions, duration ?? release.artifacts?.videoRuntimeSeconds));
    if (/\{\{[^}]+\}\}|\[[^\]]+\]|\b(?:TBD|TODO|PENDING)\b/i.test(captions)) {
      errors.push('Final captions contain unresolved placeholder text');
    }
    if (rendered.files.has('DEMO_CAPTIONS.srt')
        && captions !== rendered.files.get('DEMO_CAPTIONS.srt')) {
      errors.push('Final captions do not match the manifest-generated caption file');
    }
  }

  const imageChecks = [
    [thumbnailPath, config.thumbnailPath, 'Thumbnail', requirements.minimumThumbnailWidth, requirements.minimumThumbnailHeight],
    ...galleryPaths.map((path, index) => [
      path,
      config.galleryPaths[index],
      `Gallery image ${index + 1}`,
      requirements.minimumGalleryWidth,
      requirements.minimumGalleryHeight,
    ]),
  ];
  for (const [path, configuredPath, label, minimumWidth, minimumHeight] of imageChecks) {
    if (!path) continue;
    if (!existsSync(path)) {
      errors.push(`Missing ${label.toLowerCase()}: ${configuredPath}`);
      continue;
    }
    try {
      errors.push(...validateImageMetadata(await sharp(path).metadata(), label, minimumWidth, minimumHeight));
    } catch (error) {
      errors.push(`Could not inspect ${label.toLowerCase()}: ${error.message}`);
    }
  }

  warnings.push('Manual gate remains: confirm every image is a real recorded product capture with no personal information.');
  warnings.push('Manual gate remains: listen on headphones, laptop speakers, and a second device.');
  return { errors, warnings };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'check-media.mjs');
if (isMain) {
  const strict = process.argv.includes('--strict');
  const unknown = process.argv.slice(2).filter((arg) => arg !== '--strict');
  if (unknown.length) {
    console.error(`Unknown arguments: ${unknown.join(', ')}`);
    process.exit(2);
  }
  const result = await checkMediaFiles();
  console.log(`Media readiness: ${result.errors.length ? 'BLOCKED' : 'READY'}`);
  console.log(`Blocking items: ${result.errors.length}`);
  result.errors.forEach((error) => console.log(`  - ${error}`));
  console.log(`Manual warnings: ${result.warnings.length}`);
  result.warnings.forEach((warning) => console.log(`  - ${warning}`));
  if (strict && result.errors.length) process.exitCode = 1;
}
