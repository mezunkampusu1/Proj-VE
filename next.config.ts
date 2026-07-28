import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker imajını küçük tutmak için bağımsız (standalone) çıktı üretir.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // src/middleware.ts neredeyse tüm istekleri (statikler/api/auth hariç)
    // yakaladığı için dosya yükleme uçları da middleware'den geçiyor;
    // Next.js'in bu istekler için varsayılan 10 MB gövde sınırı, MAX_FILE_SIZE_BYTES
    // (src/lib/storage.ts) ile ilan edilen 25 MB'lık uygulama limitinden önce
    // devreye girip formData() parse'ını patlatıyordu. Sınırı 30 MB'a çekerek
    // uygulama limitine (25 MB) net biçimde yer açılıyor.
    proxyClientMaxBodySize: "30mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
