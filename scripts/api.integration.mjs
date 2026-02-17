import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';

const workspaceRoot = process.cwd();
const buildEntry = path.join(workspaceRoot, '.output', 'server', 'index.mjs');
const dbPath = path.join(workspaceRoot, 'data', 'solari.test.db');
const migrationPath = path.join(workspaceRoot, 'drizzle', '0000_worried_wraith.sql');
const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;

function initTestDatabase() {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(migrationSql);
  db.close();
}

async function waitForServerReady() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Keep retrying until timeout.
    }
    await delay(250);
  }

  throw new Error('Server did not become ready in time');
}

async function requestJson(endpoint, init) {
  const response = await fetch(`${baseUrl}${endpoint}`, init);
  const contentType = response.headers.get('content-type') || '';
  assert.ok(contentType.includes('application/json'), `Expected JSON response for ${endpoint}`);
  const payload = await response.json();
  return { response, payload };
}

async function run() {
  if (!fs.existsSync(buildEntry)) {
    throw new Error('Build output is missing. Run "npm run build" before executing this test.');
  }

  initTestDatabase();

  const server = spawn(process.execPath, [buildEntry], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      PORT: String(port),
      SOLARI_DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  try {
    await waitForServerReady();

    let result = await requestJson('/api/health');
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.status, 'ok');

    result = await requestJson('/api/stats');
    assert.equal(result.response.status, 200);
    assert.equal(typeof result.payload.library.total, 'number');

    const movieTitle = `API Test Movie ${Date.now()}`;
    result = await requestJson('/api/media/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: movieTitle }),
    });
    assert.equal(result.response.status, 201);
    const movieId = result.payload.id;
    assert.equal(typeof movieId, 'number');

    result = await requestJson('/api/media/movies');
    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.payload));
    assert.ok(result.payload.some((movie) => movie.id === movieId && movie.title === movieTitle));

    result = await requestJson('/api/downloads/999999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    });
    assert.equal(result.response.status, 404);
    assert.equal(result.payload.error, 'Download not found');

    console.log('API integration tests passed.');
  } finally {
    server.kill();
    await delay(300);

    if (!server.killed) {
      server.kill('SIGKILL');
    }

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
