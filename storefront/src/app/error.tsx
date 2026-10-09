'use client';

import { useEffect } from 'react';

/**
 * Route error boundary. It renders on the client, where the locale cookie is
 * not readable, so the message is bilingual.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container">
      <div className="empty-state" role="alert">
        <h1>
          Something went wrong
          <span className="visually-hidden"> / حدث خطأ ما</span>
        </h1>
        <p className="lead" lang="en">
          The page could not be loaded. Please try again.
        </p>
        <p className="lead" lang="ar" dir="rtl">
          تعذر تحميل الصفحة. يرجى المحاولة مرة أخرى.
        </p>
        <button type="button" className="button" onClick={() => reset()}>
          Try again / حاول مرة أخرى
        </button>
      </div>
    </div>
  );
}
