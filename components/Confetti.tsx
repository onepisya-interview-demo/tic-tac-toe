'use client';

export function Confetti() {
  return (
    <div className="confetti" data-testid="confetti" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="confetti-piece" />
      ))}
    </div>
  );
}
