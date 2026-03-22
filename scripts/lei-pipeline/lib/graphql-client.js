// scripts/lei-pipeline/lib/graphql-client.js
//
// Uses curl as HTTP transport because Cloudflare blocks Node.js native fetch
// (TLS fingerprint mismatch). curl passes Cloudflare's bot detection.

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const GRAPHQL_URL = 'https://www.jusbrasil.com.br/web-docview/graphql';
const SEARCH_URL = 'https://www.jusbrasil.com.br/graphql';
const PROXY_URL = process.env.PROXY_URL || '';

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Origin': 'https://www.jusbrasil.com.br'
};

/**
 * POST JSON to a URL using curl, return parsed response.
 * Uses a temp file for the request body to avoid shell escaping issues.
 */
async function curlPost(url, body) {
  const tmpPath = join(tmpdir(), `lei-pipeline-${randomUUID()}.json`);
  await writeFile(tmpPath, JSON.stringify(body), 'utf-8');

  try {
    const args = [
      '-s', '-S',                          // silent but show errors
      '-X', 'POST',
      '-w', '\n%{http_code}',              // append HTTP status code
      '-H', `Content-Type: ${HEADERS['Content-Type']}`,
      '-H', `User-Agent: ${HEADERS['User-Agent']}`,
      '-H', `Origin: ${HEADERS['Origin']}`,
      '-d', `@${tmpPath}`,
      '--max-time', '30',
      ...(PROXY_URL ? ['--proxy', PROXY_URL] : []),
      url
    ];

    const stdout = await new Promise((resolve, reject) => {
      execFile('curl', args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`curl failed: ${err.message} ${stderr}`));
        resolve(stdout);
      });
    });

    // Last line is the HTTP status code
    const lines = stdout.trimEnd().split('\n');
    const httpStatus = parseInt(lines.pop(), 10);
    const responseBody = lines.join('\n');

    if (httpStatus < 200 || httpStatus >= 300) {
      throw new Error(`HTTP ${httpStatus}: ${responseBody.slice(0, 500)}`);
    }

    try {
      return JSON.parse(responseBody);
    } catch (e) {
      throw new Error(`Invalid JSON from ${url}: ${responseBody.slice(0, 300)}`);
    }
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function queryDocView(query, variables = {}, operationName) {
  const body = { query, variables };
  if (operationName) body.operationName = operationName;

  const json = await curlPost(GRAPHQL_URL, body);
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors[0].message}`);
  return json.data;
}

export async function querySearch(query, variables = {}, operationName) {
  const body = { query, variables };
  if (operationName) body.operationName = operationName;

  const json = await curlPost(SEARCH_URL, body);
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors[0].message}`);
  return json.data;
}

export async function fetchWithRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`  Retry ${i + 1}/${retries}: ${err.message}`);
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}
