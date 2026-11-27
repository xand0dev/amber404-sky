// Власники шляхів (SPEC §9, §5.3). Змінює лише власник F0.
export const FEATURES = {
  F1: ['pipeline/sky/forecast/', 'pipeline/tests/forecast/', 'docs/pitch/interviews.md'],
  F2: ['pipeline/sky/galileo/', 'pipeline/sky/climate/', 'pipeline/sky/space/', 'pipeline/tests/space/', 'docs/pitch/business.md'],
  F3: ['web/src/features/map/', 'web/src/features/layers/', 'web/src/features/timeline/', 'web/src/ui/'],
  F4: ['web/src/features/panel/', 'web/src/features/route/', 'docs/pitch/'],
};

export function ownsFile(feature, file) {
  if (file.startsWith(`specs/${feature}/`)) return true;
  return (FEATURES[feature] ?? []).some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
}
