const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';
const TMP_DIR = path.join(__dirname, '..', 'tmp');

/**
 * Download a video file from a URL to a local temporary path.
 *
 * @param {string} url - Public URL of the video
 * @param {string} filename - Local filename to save as
 * @returns {Promise<string>} Absolute path to the downloaded file
 */
async function downloadVideo(url, filename) {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  const filePath = path.join(TMP_DIR, filename);
  console.log(`[Facebook] Downloading video to ${filePath}...`);

  const response = await axios.get(url, { responseType: 'stream', timeout: 120000 });
  const writer = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  console.log('[Facebook] Download complete.');
  return filePath;
}

/**
 * Post a video to a Facebook Page using the Graph API.
 *
 * Step 1 — Upload the video file to the Page's video endpoint.
 * Step 2 — The description is supplied during upload.
 *
 * @param {string} pageId - Facebook Page ID
 * @param {string} accessToken - Page access token
 * @param {string} videoPath - Absolute local path to the video file
 * @param {string} description - Caption / description for the post
 * @returns {Promise<string>} The Facebook video ID of the uploaded post
 */
async function postVideoToFacebook(pageId, accessToken, videoPath, description) {
  console.log(`[Facebook] Uploading video to page ${pageId}...`);

  const form = new FormData();
  form.append('source', fs.createReadStream(videoPath));
  form.append('description', description);
  form.append('access_token', accessToken);

  const response = await axios.post(
    `${GRAPH_API_BASE}/${pageId}/videos`,
    form,
    {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000,
    }
  );

  const videoId = response.data.id;
  console.log(`[Facebook] Video posted successfully. Facebook video ID: ${videoId}`);
  return videoId;
}

/**
 * Download a TikTok video and post it to a Facebook Page, then remove the
 * temporary local file.
 *
 * @param {object} params
 * @param {string} params.pageId - Facebook Page ID
 * @param {string} params.accessToken - Facebook Page access token
 * @param {string} params.downloadUrl - TikTok video download URL
 * @param {string} params.caption - TikTok caption to use as Facebook post text
 * @param {string} params.videoId - TikTok video ID (used as temp filename)
 * @returns {Promise<string>} Facebook video ID
 */
async function downloadAndPost({ pageId, accessToken, downloadUrl, caption, videoId }) {
  const filename = `${videoId}.mp4`;
  const videoPath = await downloadVideo(downloadUrl, filename);

  try {
    const fbVideoId = await postVideoToFacebook(pageId, accessToken, videoPath, caption);
    return fbVideoId;
  } finally {
    // Always clean up the temporary file
    try {
      await fs.promises.unlink(videoPath);
    } catch (err) {
      console.warn(`[Facebook] Could not remove temp file ${videoPath}: ${err.message}`);
    }
  }
}

module.exports = { downloadAndPost };
