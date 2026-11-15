import * as THREE from 'three';
import type { PlayerColor } from '../types/GameTypes';

/** Where each kingdom's colour sits on the colour wheel, 0 to 1. */
const HUE: Record<PlayerColor, number> = { blue: 0.61, yellow: 0.125, green: 0.33, red: 0.005 };
/** Gold has to be brighter than the blue it replaces to read as gold. */
const LIFT: Record<PlayerColor, number> = { blue: 1, yellow: 1.55, green: 1.05, red: 1.1 };

/** Turns the colours a model was painted in for one kingdom into another's. */
export interface Repaint {
  from: PlayerColor;
  to: PlayerColor;
}

const HELPERS = /* glsl */ `
  uniform float uGlow;
  uniform float uHueFrom;
  uniform float uHueTo;
  uniform float uLift;
  // The texture's own colour, kept from before any repainting.
  vec3 paintedColour;
  vec3 toHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1.0e-10)), d / (q.x + 1.0e-10), q.x);
  }
  vec3 fromHsv(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
`;

// Texels near the first kingdom's hue, and coloured enough to be cloth or
// roof rather than stone, move round the wheel to the second kingdom's.
const REPAINT = /* glsl */ `
  {
    vec3 hsv = toHsv(diffuseColor.rgb);
    float off = abs(fract(hsv.x - uHueFrom + 0.5) - 0.5);
    float w = (1.0 - smoothstep(0.07, 0.14, off)) * smoothstep(0.2, 0.4, hsv.y);
    hsv.x = fract(hsv.x + (uHueTo - uHueFrom) * w);
    hsv.z = min(1.0, hsv.z * mix(1.0, uLift, w));
    diffuseColor.rgb = fromHsv(hsv);
  }
`;

// Texels that are both bright and warm (lit windows, flames) are added to the
// light the surface gives off, which the bloom pass then spreads.
const GLOW = /* glsl */ `
  {
    float warm = smoothstep(0.5, 0.9, paintedColour.r) * smoothstep(0.1, 0.32, paintedColour.r - paintedColour.b);
    totalEmissiveRadiance += paintedColour * warm * uGlow;
  }
`;

/**
 * A copy of a generated model's material, adjusted in the shader: `glow`
 * makes the windows and flames painted into its texture shine, and `repaint`
 * changes the kingdom whose colours it wears.
 */
export function paintedMaterial(
  source: THREE.MeshStandardMaterial,
  glow: number,
  repaint?: Repaint,
): THREE.MeshStandardMaterial {
  const material = source.clone();
  // The scene has no environment to reflect, which would leave metal parts black.
  material.metalness = 0;
  material.metalnessMap = null;
  const shift = repaint && repaint.from !== repaint.to ? repaint : undefined;
  if (glow <= 0 && !shift) return material;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = { value: glow };
    shader.uniforms.uHueFrom = { value: shift ? HUE[shift.from] : 0 };
    shader.uniforms.uHueTo = { value: shift ? HUE[shift.to] : 0 };
    shader.uniforms.uLift = { value: shift ? LIFT[shift.to] : 1 };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HELPERS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n  paintedColour = diffuseColor.rgb;\n${shift ? REPAINT : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${glow > 0 ? GLOW : ''}`);
  };
  material.customProgramCacheKey = () => `painted-${glow}-${shift ? `${shift.from}-${shift.to}` : 'own'}`;
  return material;
}
