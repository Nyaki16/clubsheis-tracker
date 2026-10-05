import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit loads its standard fonts (Helvetica.afm etc.) at runtime, which the
  // bundler can't see. Keeping it a plain Node import keeps those files reachable.
  serverExternalPackages: ["pdfkit"],
  // The proposal routes read the logo and the About Us PDF from public/ on the server.
  outputFileTracingIncludes: {
    "/api/proposal/**": ["./public/csi-logo.png", "./public/ClubSheIs-About-Us.pdf"],
  },
};

export default nextConfig;
