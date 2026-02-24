const axios = require('axios');

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const TIKTOK_SCRAPER_ACTOR = 'clockworks~free-tiktok-scraper';

/**
 * Fetch the latest videos from a TikTok username using the Apify TikTok Scraper.
 * Returns an array of video objects sorted newest-first.
 *
 * @param {string} username - TikTok username (without @)
 * @param {string} apifyToken - Apify API token
 * @param {number} [maxItems=10] - Maximum number of videos to retrieve
 * @returns {Promise<Array>} Array of TikTok video objects
 */
async function fetchLatestVideos(username, apifyToken, maxItems = 10) {
  console.log(`[TikTok] Fetching latest videos for @${username}...`);

  // Run the Apify actor synchronously and wait for the result
  const runResponse = await axios.post(
    `${APIFY_BASE_URL}/acts/${TIKTOK_SCRAPER_ACTOR}/run-sync-get-dataset-items`,
    {
      profiles: [`https://www.tiktok.com/@${username}`],
      resultsPerPage: maxItems,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    },
    {
      params: { token: apifyToken },
      timeout: 120000,
    }
  );

  const videos = runResponse.data;

  if (!Array.isArray(videos) || videos.length === 0) {
    console.log('[TikTok] No videos returned from Apify.');
    return [];
  }

  // Normalise each item to a consistent shape
  const normalised = videos.map((item) => ({
    id: item.id,
    url: item.webVideoUrl || item.videoUrl || '',
    downloadUrl: item.videoMeta?.downloadAddr || item.downloadUrl || '',
    caption: item.text || '',
    createTime: item.createTime || 0,
  }));

  // Sort newest first
  normalised.sort((a, b) => b.createTime - a.createTime);

  console.log(`[TikTok] Retrieved ${normalised.length} video(s).`);
  return normalised;
}

module.exports = { fetchLatestVideos };
