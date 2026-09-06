import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={
        `bg-bg-elevated border border-border-subtle rounded-lg p-6 ${className ?? ''}`.trim()
      }
    >
      {children}
    </div>
  );
}
