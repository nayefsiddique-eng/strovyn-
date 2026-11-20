'use client';

import React from 'react';
import Image from 'next/image';

export function isPrivateGatedEditorialMediaSrc(src: string | null | undefined): boolean {
  return Boolean(src && src.startsWith('/api/editorial-media/'));
}

export function PublicArticleMedia({
  src,
  alt,
  sizes = '(max-width: 1024px) 100vw, 50vw',
  priority = false,
  className = '',
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div className="w-full h-full bg-charcoal flex items-center justify-center p-6 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-warm-grey/70">
          [ STROVYN TECHNICAL BRIEF ]
        </span>
      </div>
    );
  }

  // Never route publication-gated `/api/editorial-media/<uuid>` through Next Image
  // optimization cache so article archival revokes public access immediately (404).
  if (isPrivateGatedEditorialMediaSrc(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        className={`w-full h-full object-cover object-center ${className}`}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={`object-cover object-center ${className}`}
    />
  );
}
