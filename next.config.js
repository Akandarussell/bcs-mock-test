/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deployed to Vercel (supports server-side /api/tutor route for Gemini AI while
  // keeping @heyputer/puter.js auth & KV strictly client-side).
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;

