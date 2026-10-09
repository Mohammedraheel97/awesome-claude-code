'use client';

import { useState } from 'react';
import type { Image } from '@/lib/commerce/types';

type Props = { images: Image[]; title: string; label: string; thumbLabel: string };

export function ProductGallery({ images, title, label, thumbLabel }: Props) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  if (!current) {
    return <div className="gallery__main" aria-label={label} />;
  }

  return (
    <div className="gallery" aria-label={label}>
      <div className="gallery__main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.altText ?? title}
          width={current.width ?? 800}
          height={current.height ?? 800}
          fetchPriority={active === 0 ? 'high' : 'auto'}
        />
      </div>
      {images.length > 1 ? (
        <div className="gallery__thumbs" role="group" aria-label={label}>
          {images.map((image, i) => (
            <button
              key={`${image.url}-${i}`}
              type="button"
              className="gallery__thumb"
              aria-pressed={i === active}
              aria-label={`${thumbLabel} ${i + 1}`}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" width={72} height={72} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
