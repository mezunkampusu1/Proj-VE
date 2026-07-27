import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker imajını küçük tutmak için bağımsız (standalone) çıktı üretir.
  output: "standalone",
};

export default nextConfig;
