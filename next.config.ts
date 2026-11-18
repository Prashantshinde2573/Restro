import type { NextConfig } from "next";

// Security headers on every page (see docs/SECURITY.md).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // no one can put Restropi inside their site (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // camera: menu photos; microphone: voice ordering; payment: the restaurant's own Razorpay / Cashfree checkout
  { key: "Permissions-Policy", value: 'camera=(self), microphone=(self), geolocation=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com" "https://sdk.cashfree.com" "https://api.cashfree.com" "https://sandbox.cashfree.com")' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
