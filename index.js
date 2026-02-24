require('dotenv').config();
const cron = require('node-cron');
const { fetchLatestVideos } = require('./services/tiktokService');
const { downloadAndPost } = require('./services/facebookService');
const { isProcessed, markAsProcessed } = require('./services/storageService');

// Validate required environment variables
const REQUIRED_ENV = ['APIFY_TOKEN', 'TIKTOK_USERNAME', 'FACEBOOK_PAGE_ID', 'FACEBOOK_ACCESS_TOKEN'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Config] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const {
  APIFY_TOKEN,
  TIKTOK_USERNAME,
  FACEBOOK_PAGE_ID,
  FACEBOOK_ACCESS_TOKEN,
} = process.env;

/**
 * Check for new TikTok videos and post any unprocessed ones to Facebook.
 */
async function checkAndPost() {
  console.log(`\n[Cron] ${new Date().toISOString()} — Checking @${TIKTOK_USERNAME} for new videos...`);

  let videos;
  try {
    videos = await fetchLatestVideos(TIKTOK_USERNAME, APIFY_TOKEN);
  } catch (err) {
    console.error('[Cron] Failed to fetch TikTok videos:', err.message);
    return;
  }

  for (const video of videos) {
    if (!video.id) {
      console.warn('[Cron] Skipping video with missing ID.');
      continue;
    }

    if (isProcessed(video.id)) {
      console.log(`[Cron] Video ${video.id} already processed — skipping.`);
      continue;
    }

    if (!video.downloadUrl) {
      console.warn(`[Cron] Video ${video.id} has no download URL — skipping.`);
      markAsProcessed(video.id);
      continue;
    }

    console.log(`[Cron] New video detected: ${video.id}`);

    try {
      await downloadAndPost({
        pageId: FACEBOOK_PAGE_ID,
        accessToken: FACEBOOK_ACCESS_TOKEN,
        downloadUrl: video.downloadUrl,
        caption: video.caption,
        videoId: video.id,
      });

      markAsProcessed(video.id);
      console.log(`[Cron] Successfully posted video ${video.id} to Facebook.`);
    } catch (err) {
      console.error(`[Cron] Failed to post video ${video.id}:`, err.message);
      // Do not mark as processed so it will be retried on the next run
    }
  }

  console.log('[Cron] Check complete.');
}

// Run immediately on startup, then every 10 minutes
console.log('[App] TikTok → Facebook automation starting...');
checkAndPost();
cron.schedule('*/10 * * * *', checkAndPost);
