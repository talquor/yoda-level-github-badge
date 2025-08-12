export type Theme = 'jedi' | 'sith';

export function themeColors(theme: Theme) {
  if (theme === 'sith') {
    return {
      leftColor: '#1a0f14',     // deep crimson black
      starA: '#ffb4b4',
      starB: '#ffd4d4',
      starC: '#ffe1e1',
      starD: '#ffc6c6'
    };
  }
  // default: jedi (space blue)
  return {
    leftColor: '#141a2a',
    starA: '#9fb6ff',
    starB: '#bcd1ff',
    starC: '#e5e7eb',
    starD: '#d1d5db'
  };
}
