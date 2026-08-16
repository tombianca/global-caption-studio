// Type declarations for packages that ship without types.
declare module 'ffprobe-static' {
  const ffprobe: { path: string; version: string };
  export default ffprobe;
}

declare module 'ffmpeg-static' {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
