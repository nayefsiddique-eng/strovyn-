import localFont from 'next/font/local';

// Inter — variable font, weights 100–900, latin subset
// Source: @fontsource-variable/inter v5.1.1 (SIL OFL 1.1)
export const inter = localFont({
  src: [
    {
      path: '../../public/fonts/inter-latin-variable-normal.woff2',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
  weight: '100 900',
});

// Playfair Display — variable font, weights 400–900, normal + italic, latin subset
// Source: @fontsource-variable/playfair-display v5.1.1 (SIL OFL 1.1)
export const playfair = localFont({
  src: [
    {
      path: '../../public/fonts/playfair-display-latin-variable-normal.woff2',
      style: 'normal',
      weight: '400 900',
    },
    {
      path: '../../public/fonts/playfair-display-latin-variable-italic.woff2',
      style: 'italic',
      weight: '400 900',
    },
  ],
  variable: '--font-serif',
  display: 'swap',
});

// Bebas Neue — static, weight 400, latin subset
// Source: @fontsource/bebas-neue v5.1.1 (SIL OFL 1.1)
export const bebasNeue = localFont({
  src: [
    {
      path: '../../public/fonts/bebas-neue-latin-400-normal.woff2',
      style: 'normal',
      weight: '400',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  weight: '400',
});

