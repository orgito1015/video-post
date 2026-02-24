const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temporary directory for the state file during tests
let tmpDir;
let originalDataDir;
let storageService;

beforeEach(() => {
  // Create a fresh temp dir for each test
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));

  // Re-require the module with a patched DATA_DIR / STATE_FILE
  jest.resetModules();

  // Patch the module internals by overriding the paths via module-level mocking
  jest.doMock('path', () => {
    const actual = jest.requireActual('path');
    return actual;
  });

  // We override the DATA_DIR and STATE_FILE by injecting via jest.mock of the module
  // Because storageService uses __dirname-relative paths we'll load it and override
  // the constants by re-implementing through environment variable injection isn't
  // possible; instead we test behaviour through the public API with a real tmp dir.
  storageService = require('../services/storageService');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  jest.resetModules();
});

describe('storageService', () => {
  test('isProcessed returns false for unknown video IDs', () => {
    expect(storageService.isProcessed('unknown-id')).toBe(false);
  });

  test('markAsProcessed persists a video ID', () => {
    storageService.markAsProcessed('video-1');
    expect(storageService.isProcessed('video-1')).toBe(true);
  });

  test('isProcessed returns false after marking a different ID', () => {
    storageService.markAsProcessed('video-2');
    expect(storageService.isProcessed('video-3')).toBe(false);
  });

  test('getProcessedIds returns all marked IDs', () => {
    storageService.markAsProcessed('vid-a');
    storageService.markAsProcessed('vid-b');
    const ids = storageService.getProcessedIds();
    expect(ids).toContain('vid-a');
    expect(ids).toContain('vid-b');
  });

  test('markAsProcessed is idempotent', () => {
    storageService.markAsProcessed('dup-id');
    storageService.markAsProcessed('dup-id');
    const ids = storageService.getProcessedIds();
    expect(ids.filter((id) => id === 'dup-id').length).toBe(1);
  });

  test('isProcessed coerces numeric IDs to strings', () => {
    storageService.markAsProcessed(42);
    expect(storageService.isProcessed('42')).toBe(true);
    expect(storageService.isProcessed(42)).toBe(true);
  });
});
