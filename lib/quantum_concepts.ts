// lib/quantum_concepts.ts
export type QConcept = {
  key: string;
  title: string;
  emoji: string;
  formula: string; // short, unicode-safe
  hint: string;    // one-liner
  more?: string;   // slightly longer line (optional)
};

export const Q_CONCEPTS: QConcept[] = [
  {
    key: 'superposition',
    title: 'Superposition',
    emoji: '🌀',
    formula: '│ψ⟩ = α│0⟩ + β│1⟩, |α|²+|β|²=1',
    hint: 'A state can be many possibilities at once until we look.',
    more: 'Think of a coin spinning—heads and tails together until it lands.'
  },
  {
    key: 'measurement',
    title: 'Measurement',
    emoji: '🎯',
    formula: 'Pr(outcome i) = |⟨i│ψ⟩|²',
    hint: 'Looking picks one outcome and collapses uncertainty.',
    more: 'We ask a question; nature returns one concrete answer.'
  },
  {
    key: 'interference',
    title: 'Interference',
    emoji: '🌊',
    formula: 'A_total = Σ A_path,  P ∝ |A_total|²',
    hint: 'Waves add and cancel; patterns emerge from sums.',
    more: 'Small changes in phase shift the pattern dramatically.'
  },
  {
    key: 'entanglement',
    title: 'Entanglement',
    emoji: '🔗',
    formula: '│ψ⟩ ≠ │a⟩⊗│b⟩ (inseparable)',
    hint: 'Two parts share one story, even when far apart.',
    more: 'Correlations exceed what classical variables can explain.'
  },
  {
    key: 'hadamard',
    title: 'Hadamard',
    emoji: '➕➖',
    formula: 'H│0⟩ = (│0⟩+│1⟩)/√2',
    hint: 'A simple mix: go from yes/no to equal blend.',
    more: 'It creates balanced superposition from a definite state.'
  },
  {
    key: 'phase',
    title: 'Phase',
    emoji: '🧭',
    formula: '│ψ⟩ → e^{iφ}│ψ⟩',
    hint: 'Timing shift that changes how waves combine.',
    more: 'Relative phase alters interference even if probabilities match.'
  },
  {
    key: 'decoherence',
    title: 'Decoherence',
    emoji: '💨',
    formula: 'ρ → ρ_{diag} (off-diagonals fade)',
    hint: 'Noise leaks info; quantum blends act classical.',
    more: 'Environment “measures” the system and erases fragile phases.'
  },
  {
    key: 'uncertainty',
    title: 'Uncertainty',
    emoji: '⚖️',
    formula: 'Δx·Δp ≥ ħ/2',
    hint: 'Sharpen one thing, blur another—limits exist.',
    more: 'Precision in one observable costs precision in its partner.'
  }
];

export function conceptForIndex(i: number) {
  return Q_CONCEPTS[i % Q_CONCEPTS.length];
}

export function indexForKey(key: string): number {
  const idx = Q_CONCEPTS.findIndex(c => c.key.toLowerCase() === key.toLowerCase());
  return idx >= 0 ? idx : 0;
}
