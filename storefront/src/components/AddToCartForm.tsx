'use client';

import { useActionState, useState } from 'react';
import { addToCartAction, type CartActionState } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { MAX_LINE_QUANTITY } from '@/lib/commerce/types';

type Props = {
  variantId: string | null;
  available: boolean;
  labels: {
    addToCart: string;
    adding: string;
    soldOut: string;
    unavailable: string;
    quantity: string;
    decrease: string;
    increase: string;
  };
};

const initial: CartActionState = { status: 'idle', message: '' };

export function AddToCartForm({ variantId, available, labels }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [state, action] = useActionState(addToCartAction, initial);
  const canBuy = Boolean(variantId) && available;

  return (
    <form action={action} className="add-to-cart">
      <input type="hidden" name="variantId" value={variantId ?? ''} />
      <div className="buy-row">
        <div className="quantity" role="group" aria-label={labels.quantity}>
          <button
            type="button"
            aria-label={labels.decrease}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || !canBuy}
          >
            −
          </button>
          <input
            type="number"
            name="quantity"
            min={1}
            max={MAX_LINE_QUANTITY}
            value={quantity}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) setQuantity(Math.min(MAX_LINE_QUANTITY, Math.max(1, n)));
            }}
            aria-label={labels.quantity}
            disabled={!canBuy}
          />
          <button
            type="button"
            aria-label={labels.increase}
            onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
            disabled={quantity >= MAX_LINE_QUANTITY || !canBuy}
          >
            +
          </button>
        </div>
        <SubmitButton className="button" pendingLabel={labels.adding} disabled={!canBuy}>
          {available ? labels.addToCart : labels.soldOut}
        </SubmitButton>
      </div>
      <p
        className={`form-status${state.status === 'success' ? ' form-status--success' : ''}${state.status === 'error' ? ' form-status--error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {state.message}
      </p>
    </form>
  );
}
