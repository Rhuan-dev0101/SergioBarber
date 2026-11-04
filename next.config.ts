import type { NextConfig } from "next";

const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wokeokwhvkghmbxbaxgt.supabase.co'
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^https:/, 'wss:')

const isDev = process.env.NODE_ENV === 'development'

// Content-Security-Policy
//
// Cada origem abaixo corresponde a algo que a aplicacao realmente carrega:
//   - Supabase        -> REST/Auth (connect) e imagens do Storage (avatar, galeria)
//   - images.unsplash -> imagens de fallback do conteudo institucional
//   - googleusercontent / fbcdn -> avatares retornados pelo login Google/Facebook
//   - i.ytimg / youtube -> thumbnails e <iframe> do tutorial embutido
//
// 'unsafe-inline' em script-src: o Next injeta scripts inline de hidratacao.
// Elimina-lo exige CSP por nonce, que obriga renderizacao dinamica em todas
// as rotas (perde o cache estatico das paginas institucionais). Fica como
// evolucao futura; as demais diretivas ja barram exfiltracao para dominios
// de terceiros, que e' o impacto pratico de um XSS aqui.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://images.unsplash.com https://*.googleusercontent.com https://*.fbcdn.net https://i.ytimg.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  // Remove o header `X-Powered-By: Next.js`, que expoe a stack usada.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wokeokwhvkghmbxbaxgt.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      // Avatares dos logins Google/Facebook (ja liberados na CSP em img-src).
      { protocol: 'https', hostname: '*.googleusercontent.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: '*.fbcdn.net', port: '', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            // Desliga APIs sensiveis do browser que a aplicacao nao usa.
            key: 'Permissions-Policy',
            value: [
              'accelerometer=()',
              'autoplay=()',
              'camera=()',
              'display-capture=()',
              'encrypted-media=()',
              'geolocation=()',
              'gyroscope=()',
              'magnetometer=()',
              'microphone=()',
              'payment=()',
              'usb=()',
              'xr-spatial-tracking=()',
            ].join(', '),
          },
          {
            // A Vercel ja envia HSTS no dominio *.vercel.app; declarar aqui
            // garante o mesmo comportamento em dominio proprio.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
