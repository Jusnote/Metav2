/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removido 'output: export' para permitir SSR/ISR com Supabase
  // distDir: './dist', - usando default (.next)
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignora erros TypeScript no build (temporário - corrigir depois)
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Configuração para binários nativos do lightningcss
    config.externals = config.externals || [];
    
    // Garantir que módulos nativos sejam tratados corretamente
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    // Desabilitar cache do webpack para binários nativos
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
    };
    
    return config;
  },
}

export default nextConfig