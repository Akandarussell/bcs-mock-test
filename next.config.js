/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export -> ./out (upload to Puter Hosting, Vercel, GitHub Pages, Netlify ...)
  output: 'export',
  // Emit /history/index.html etc. so plain static hosts resolve routes without rewrites
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;

