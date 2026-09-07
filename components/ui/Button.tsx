import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const base =
  'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-[120ms] ease-out ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-bg-base hover:bg-accent-hover px-5 py-2.5 text-base',
  secondary:
    'bg-bg-elevated text-text-primary hover:bg-bg-hover border border-border-subtle px-5 py-2.5 text-base',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover px-3 py-2 text-sm',
};

export function Button({ variant = 'primary', className, children, ...rest }: Props) {
  return (
    <button {...rest} className={`${base} ${variants[variant]} ${className ?? ''}`.trim()}>
      {children}
    </button>
  );
}
