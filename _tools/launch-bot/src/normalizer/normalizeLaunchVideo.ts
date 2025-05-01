import { LaunchVideo } from "../types";

type Normalizer = (video: LaunchVideo, url: URL) => LaunchVideo | null;

const normalizers: Normalizer[] = [
  // YouTube normalizer
  (video, url) => {
    let videoId: string | null = null;

    if (url.hostname === 'youtu.be') {
      videoId = url.pathname.slice(1);
    } else if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/embed/')[1];
      }
    }

    if (videoId) {
      return {
        ...video,
        source: 'youtube',
        video_id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`
      };
    }

    return null;
  }

  // Add more normalizers here
];

export function normalizeLaunchVideo(video: LaunchVideo): LaunchVideo {
  try {
    const url = new URL(video.url);

    for (const normalize of normalizers) {
      const result = normalize(video, url);
      if (result) return result;
    }

    return video; // No matching normalizer found
  } catch {
    return video; // Invalid URL
  }
}