/**
 * Presentation data is deliberately separate from PLAY_COURSE geometry.
 * Generated art and labels may change without changing collision evidence.
 */
export const HAZARD_PRESENTATION = Object.freeze({
  'static-1': Object.freeze({
    name: 'Rift Spire',
    shortLabel: 'RIFT',
    cue: 'Tall fracture',
    variant: 'rift-spire',
    image: '/hazards/rift-spire.webp',
  }),
  'static-2': Object.freeze({
    name: 'Pulse Mine',
    shortLabel: 'PULSE',
    cue: 'Round reactor',
    variant: 'pulse-mine',
    image: '/hazards/pulse-mine.webp',
  }),
  'static-3': Object.freeze({
    name: 'Static Thorn',
    shortLabel: 'THORN',
    cue: 'Needle beacon',
    variant: 'static-thorn',
    image: '/hazards/static-thorn.webp',
  }),
});

export const hazardPresentationFor = (hazardId) => {
  const presentation = HAZARD_PRESENTATION[hazardId];
  if (!presentation) throw new Error(`Missing presentation for hazard: ${hazardId}`);
  return presentation;
};
