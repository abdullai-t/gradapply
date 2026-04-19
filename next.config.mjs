/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/tracker", destination: "/schools", permanent: false },
      {
        source: "/tracker/:path*",
        destination: "/schools/:path*",
        permanent: false,
      },
      { source: "/ai-coach", destination: "/assistant", permanent: false },
      {
        source: "/ai-coach/:path*",
        destination: "/assistant/:path*",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
