'use client';

import { useActionState } from 'react';
import { subscribeNewsletterAction, type NewsletterState } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';

const initial: NewsletterState = { status: 'idle', message: '' };

export function NewsletterForm() {
  const [state, action] = useActionState(subscribeNewsletterAction, initial);
  return (
    <form action={action} className="footer-form" noValidate={false}>
      <label className="visually-hidden" htmlFor="newsletter-email">
        Email address
      </label>
      <input
        id="newsletter-email"
        className="field"
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="Email address"
      />
      <SubmitButton className="button button--secondary" pendingLabel="…">
        Subscribe
      </SubmitButton>
      <p className="footer-status" role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}
