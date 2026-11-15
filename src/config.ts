/**
 * Switches read from the page address, for trying things out:
 *
 *   ?map=flat|river  board layout (river by default)
 *   ?skirmish        start with armies already in contact
 *   ?nopost          switch post-processing off
 */
const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const MAP_TYPE: 'flat' | 'river' = params.get('map') === 'flat' ? 'flat' : 'river';
export const SKIRMISH = params.has('skirmish');
export const POST_FX = !params.has('nopost');
