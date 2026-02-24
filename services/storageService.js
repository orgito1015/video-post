const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'processed.json');

/**
 * Ensure the data directory and state file exist.
 */
function ensureStateFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ processedIds: [] }), 'utf8');
  }
}

/**
 * Read the list of already-processed TikTok video IDs.
 *
 * @returns {string[]} Array of processed video ID strings
 */
function getProcessedIds() {
  ensureStateFile();
  const raw = fs.readFileSync(STATE_FILE, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.processedIds) ? data.processedIds : [];
}

/**
 * Persist a new video ID to the processed list.
 *
 * @param {string} videoId - The TikTok video ID to mark as processed
 */
function markAsProcessed(videoId) {
  ensureStateFile();
  const ids = getProcessedIds();
  if (!ids.includes(String(videoId))) {
    ids.push(String(videoId));
    fs.writeFileSync(STATE_FILE, JSON.stringify({ processedIds: ids }, null, 2), 'utf8');
    console.log(`[Storage] Marked video ${videoId} as processed.`);
  }
}

/**
 * Check whether a video ID has already been processed.
 *
 * @param {string} videoId - The TikTok video ID to check
 * @returns {boolean}
 */
function isProcessed(videoId) {
  const ids = getProcessedIds();
  return ids.includes(String(videoId));
}

module.exports = { getProcessedIds, markAsProcessed, isProcessed };
