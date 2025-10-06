/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removido 'output: export' para permitir SSR/ISR com Supabase
  // distDir: './dist', - usando default (.next)
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig