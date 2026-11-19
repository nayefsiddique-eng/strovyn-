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
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

// Anton — condensed heavy architectural display face, single black-weight cut (400), latin subset
// Source: @fontsource/anton v5.3.0 (SIL OFL 1.1)
export const anton = localFont({
  src: [
    {
      path: '../../public/fonts/anton-latin-400-normal.woff2',
      style: 'normal',
      weight: '400',
    },
  ],
  variable: '--font-display',
  display: 'swap',
  weight: '400',
  fallback: ['Impact', 'Arial Narrow', 'sans-serif'],
});
