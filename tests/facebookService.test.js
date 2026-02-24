const fs = require('fs');
const path = require('path');
const axios = require('axios');

jest.mock('axios');

// Mock form-data with a factory that returns an object with the required methods
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn(() => ({ 'content-type': 'multipart/form-data' })),
  }));
});

// We need to mock fs selectively — spy on the methods used by facebookService
// while leaving others (used by Node internals) untouched.
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(actual.existsSync),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn(),
    createReadStream: jest.fn(() => 'mock-stream'),
    promises: {
      ...actual.promises,
      unlink: jest.fn().mockResolvedValue(undefined),
    },
  };
});

const { downloadAndPost } = require('../services/facebookService');

// Build a minimal mock stream that emits 'finish' synchronously
function makeMockWriter() {
  const { EventEmitter } = require('events');
  const writer = new EventEmitter();
  writer.on = jest.fn((event, cb) => {
    if (event === 'finish') setImmediate(cb);
    return writer;
  });
  return writer;
}

beforeEach(() => {
  jest.clearAllMocks();

  // Mock fs.createWriteStream to return a writer that emits 'finish'
  fs.createWriteStream.mockReturnValue(makeMockWriter());

  // Mock axios.get (video download) to return a pipeable stream
  const { EventEmitter } = require('events');
  const mockReadable = new EventEmitter();
  mockReadable.pipe = jest.fn();
  axios.get.mockResolvedValue({ data: mockReadable });

  // Mock axios.post (Facebook Graph API upload) to return a video ID
  axios.post.mockResolvedValue({ data: { id: 'fb-video-123' } });

  // Make fs.existsSync return false so mkdirSync is called
  fs.existsSync.mockReturnValue(false);
});

describe('downloadAndPost', () => {
  const params = {
    pageId: 'page-1',
    accessToken: 'access-token',
    downloadUrl: 'https://cdn.tiktok.com/vid-1.mp4',
    caption: 'Test caption',
    videoId: 'tiktok-vid-1',
  };

  test('downloads the video and posts it to Facebook, returning the FB video ID', async () => {
    const fbId = await downloadAndPost(params);
    expect(fbId).toBe('fb-video-123');
  });

  test('calls the Facebook Graph API with the correct page endpoint', async () => {
    await downloadAndPost(params);
    const [url] = axios.post.mock.calls[0];
    expect(url).toContain('/page-1/videos');
  });

  test('cleans up the temporary video file after posting', async () => {
    await downloadAndPost(params);
    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    const unlinkedPath = fs.promises.unlink.mock.calls[0][0];
    expect(unlinkedPath).toContain('tiktok-vid-1.mp4');
  });

  test('still cleans up temp file even when the Graph API call fails', async () => {
    axios.post.mockRejectedValue(new Error('API error'));

    await expect(downloadAndPost(params)).rejects.toThrow('API error');
    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
  });

  test('creates the tmp directory when it does not exist', async () => {
    fs.existsSync.mockReturnValue(false);
    await downloadAndPost(params);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  test('skips creating the tmp directory when it already exists', async () => {
    fs.existsSync.mockReturnValue(true);
    await downloadAndPost(params);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});

