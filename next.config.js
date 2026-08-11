/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Only ever serves our own static SVG avatars in /public — safe to allow.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Kokoro TTS runs entirely in the browser, but its dependency chain
  // (kokoro-js -> @huggingface/transformers -> onnxruntime-node) is ~600MB of
  // native binaries. Next traces those into the serverless bundle, which blew
  // past Vercel's 250MB function limit. Nothing server-side ever imports them.
  outputFileTracingExcludes: {
    '*': [
      'node_modules/kokoro-js/**',
      'node_modules/@huggingface/**',
      'node_modules/onnxruntime-node/**',
      'node_modules/onnxruntime-web/**',
      'node_modules/onnxruntime-common/**',
      'node_modules/sharp/**',
      'node_modules/@img/**',
    ],
  },
};

module.exports = nextConfig;
