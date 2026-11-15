import { useThree } from '@react-three/fiber';

/**
 * The board is 24x12. On wide screens the camera looks along the short axis
 * ("landscape"); on tall phone screens it turns a quarter so the long axis
 * runs up the screen ("portrait") and the whole board fits without panning.
 */
export type View = 'landscape' | 'portrait';

export function useView(): View {
  return useThree((s) => (s.size.width / s.size.height < 0.85 ? 'portrait' : 'landscape'));
}

/** Yaw that turns something built to face +Z towards the camera of each view. */
export const VIEW_YAW: Record<View, number> = {
  landscape: 0,
  portrait: -Math.PI / 2,
};

/** True on phones and tablets, where the finger is the pointer. */
export const COARSE_POINTER =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
