import nextConfig from 'eslint-config-next'

const config = [
  { ignores: ['lib/generated/**', 'node_modules/**', '.next/**'] },
  ...nextConfig,
]

export default config
