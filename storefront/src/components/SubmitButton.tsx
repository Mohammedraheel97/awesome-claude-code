'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
  'aria-label'?: string;
};

/** Submit button that disables itself while its parent form is pending. */
export function SubmitButton({ children, pendingLabel, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
