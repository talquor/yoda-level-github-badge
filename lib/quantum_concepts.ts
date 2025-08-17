// lib/quantum_concepts.ts
export type QConcept = {
  key: string;
  title: string;       // short label
  emoji: string;       // visual glyph
  hint: string;        // one-line intuition
};

export const Q_CONCEPTS: QConcept[] = [
  {
    key: 'superposition',
    title: 'Superposition',
    emoji: '🌀',
    hint: 'A state can be many possibilities at once until we look.'
  },
  {
    key: 'measurement',
    title: 'Measurement',
    emoji: '🎯',
    hint: 'Looking picks one outcome and collapses uncertainty.'
  },
  {
    key: 'interference',
    title: 'Interference',
    emoji: '🌊',
    hint: 'Waves add and cancel; patterns emerge from sums.'
  },
  {
    key: 'entanglement',
    title: 'Entanglement',
    emoji: '🔗',
    hint: 'Two parts share one story, even when far apart.'
  },
  {
    key: 'hadamard',
    title: 'Hadamard',
    emoji: '➕➖',
    hint: 'A simple mix: go from yes/no to equal blend.'
  },
  {
    key: 'phase',
    title: 'Phase',
    emoji: '🧭',
    hint: 'Timing shift that changes how waves combine.'
  },
  {
    key: 'decoherence',
    title: 'Decoherence',
    emoji: '💨',
    hint: 'Noise leaks info; quantum blends act classical.'
  },
  {
    key: 'uncertainty',
    title: 'Uncertainty',
    emoji: '⚖️',
    hint: 'Sharpen one thing, blur another — limits exist.'
  }
];

export function conceptForIndex(i: number) {
  return Q_CONCEPTS[i % Q_CONCEPTS.length];
}
