/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', 'ffmpeg-static', 'ffprobe-static', 'bullmq', 'ioredis', '@xenova/transformers', 'onnxruntime-node'],
};

export default nextConfig;
