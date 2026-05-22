import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/beats",
        destination: "/#beats",
        permanent: true
      },
      {
        source: "/plans",
        destination: "/#plans",
        permanent: true
      },
      {
        source: "/services",
        destination: "/#services",
        permanent: true
      },
      {
        source: "/about",
        destination: "/#about",
        permanent: true
      },
      {
        source: "/contact",
        destination: "/#contact",
        permanent: true
      },
      {
        source: "/kits",
        destination: "/sound-kits",
        permanent: true
      },
      {
        source: "/soundkits",
        destination: "/sound-kits",
        permanent: true
      },
      {
        source: "/sound-kit",
        destination: "/sound-kits",
        permanent: true
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
