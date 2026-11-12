// Values describe the visible surface in the overhead references. Clarity is a
// visual material parameter and has no relationship to measured water quality.
export const baselineWater = Object.freeze({
  referenceMix: 0.72,
  clarity: 0.06,
  rippleStrength: 0.009,
  bankWidth: 5.5,
});

export function waterAppearance(feature) {
  return { ...baselineWater, ...feature?.waterAppearance };
}
