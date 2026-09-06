type Props = {
  label: string;
  value: string | number;
  emphasis?: boolean;
};

export function StatsCard({ label, value, emphasis }: Props) {
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-md px-4 py-3 flex flex-col gap-1">
      <span className="text-small text-text-secondary">{label}</span>
      <span
        className={
          'text-h3 font-mono stats-value ' + (emphasis ? 'text-accent' : 'text-text-primary')
        }
        data-testid="stat-value"
        data-value={value}
      >
        {value}
      </span>
    </div>
  );
}
