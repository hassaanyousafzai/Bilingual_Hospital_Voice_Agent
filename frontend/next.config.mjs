/** @type {import('next').NextConfig} */
const API_BASE = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* to the FastAPI backend so the frontend never needs the API key.
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
