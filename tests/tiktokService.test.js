const axios = require('axios');
const { fetchLatestVideos } = require('../services/tiktokService');

jest.mock('axios');

const SAMPLE_VIDEOS = [
  {
    id: 'vid-1',
    webVideoUrl: 'https://www.tiktok.com/@user/video/1',
    videoMeta: { downloadAddr: 'https://cdn.tiktok.com/vid-1.mp4' },
    text: 'First video caption',
    createTime: 1000,
  },
  {
    id: 'vid-2',
    webVideoUrl: 'https://www.tiktok.com/@user/video/2',
    videoMeta: { downloadAddr: 'https://cdn.tiktok.com/vid-2.mp4' },
    text: 'Second video caption',
    createTime: 2000,
  },
  {
    id: 'vid-3',
    webVideoUrl: 'https://www.tiktok.com/@user/video/3',
    downloadUrl: 'https://cdn.tiktok.com/vid-3.mp4',
    text: 'Third video (fallback downloadUrl)',
    createTime: 500,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchLatestVideos', () => {
  test('returns normalised video objects sorted newest-first', async () => {
    axios.post.mockResolvedValue({ data: SAMPLE_VIDEOS });

    const videos = await fetchLatestVideos('testuser', 'apify-token');

    expect(videos).toHaveLength(3);
    // Newest first (createTime desc)
    expect(videos[0].id).toBe('vid-2');
    expect(videos[1].id).toBe('vid-1');
    expect(videos[2].id).toBe('vid-3');
  });

  test('normalises video shape correctly', async () => {
    axios.post.mockResolvedValue({ data: [SAMPLE_VIDEOS[0]] });

    const videos = await fetchLatestVideos('testuser', 'apify-token');

    expect(videos[0]).toMatchObject({
      id: 'vid-1',
      url: 'https://www.tiktok.com/@user/video/1',
      downloadUrl: 'https://cdn.tiktok.com/vid-1.mp4',
      caption: 'First video caption',
      createTime: 1000,
    });
  });

  test('falls back to item.downloadUrl when videoMeta is absent', async () => {
    axios.post.mockResolvedValue({ data: [SAMPLE_VIDEOS[2]] });

    const videos = await fetchLatestVideos('testuser', 'apify-token');

    expect(videos[0].downloadUrl).toBe('https://cdn.tiktok.com/vid-3.mp4');
  });

  test('returns empty array when Apify returns no videos', async () => {
    axios.post.mockResolvedValue({ data: [] });

    const videos = await fetchLatestVideos('testuser', 'apify-token');

    expect(videos).toEqual([]);
  });

  test('returns empty array when Apify returns non-array', async () => {
    axios.post.mockResolvedValue({ data: null });

    const videos = await fetchLatestVideos('testuser', 'apify-token');

    expect(videos).toEqual([]);
  });

  test('propagates errors thrown by axios', async () => {
    axios.post.mockRejectedValue(new Error('network error'));

    await expect(fetchLatestVideos('testuser', 'apify-token')).rejects.toThrow('network error');
  });

  test('calls Apify with the correct username URL', async () => {
    axios.post.mockResolvedValue({ data: [] });

    await fetchLatestVideos('myuser', 'my-token');

    const callBody = axios.post.mock.calls[0][1];
    expect(callBody.profiles).toContain('https://www.tiktok.com/@myuser');
  });
});
