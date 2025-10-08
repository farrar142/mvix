#!/usr/bin/env node

import fs from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import Fastify from 'fastify';
import { findFileCaseInsensitively, isExistingFile } from './utils.mjs';

/* eslint-disable no-console */

if (!(await isExistingFile('index.html'))) {
  console.error('Please run mvix in the game folder.');
  process.exit(1);
}

const PWD = process.cwd();
const DEBUG_MODE = Boolean(process.env.DEBUG);
const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE_DATA_PATH = path.join(PWD, 'mvix.json');
const PATCHES_DIR = path.join(__dirname, 'patches');
const SAVE_DIR = './save';

const server = Fastify({ logger: DEBUG_MODE });

await server.register(import('@fastify/static'), {
  root: PWD,
  index: false,
  prefix: '/static/', // FIXME: workaround to FastifyError: Method 'HEAD' already declared for route '/*'
});

/**
 * JSON Key를 파일명으로 변환하는 함수
 * @param {string} jsonKey 요청/응답 JSON의 키 (예: "RPG Config", "RPG File5", "RPG Global")
 * @returns {string | null} 변환된 파일명 (예: "config.rpgsave", "file5.rpgsave"), 규칙에 맞지 않으면 null
 */
const getFileName = (jsonKey) => {
  // 1. "RPG Config" -> "config.rpgsave"
  if (jsonKey === "RPG Config") {
    return "config.rpgsave";
  }

  // 2. "RPG Global" -> "global.rpgsave"
  if (jsonKey === "RPG Global") {
    return "global.rpgsave";
  }

  // 3. "RPG File[n]" -> "file[n].rpgsave" (예: "RPG File5" -> "file5.rpgsave")
  const fileMatch = jsonKey.match(/^RPG File(\d+)$/);
  if (fileMatch) {
    const fileNumber = fileMatch[1]; // 정규식 캡처 그룹에서 숫자 추출
    return `file${fileNumber}.rpgsave`;
  }

  // 매칭되는 규칙이 없는 경우
  return null;
};


// ----------------------------------------------------------------------
// /mvix/save 엔드포인트: JSON -> 개별 파일 저장
// ----------------------------------------------------------------------
server.post('/mvix/save', async (req, reply) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      //json이 아니라string이면 object로 변환해줘
      if (typeof req.body === 'string') {
        req.body = JSON.parse(req.body);
      } else {
        return reply.code(400).send({ error: 'Invalid body format. Expected JSON object.' });
      }
    }

    const writePromises = [];

    // 요청 본문의 모든 키-값 쌍을 순회합니다.
    for (const [jsonKey, fileContent] of Object.entries(req.body)) {
      const fileName = getFileName(jsonKey);

      if (fileName && typeof fileContent === 'string') {
        const filePath = path.join(SAVE_DIR, fileName);
        // 파일 쓰기 작업을 Promise 배열에 추가
        writePromises.push(fs.writeFile(filePath, fileContent, 'utf8'));
      } else {
        console.warn(`[SAVE] Skipping key "${jsonKey}". Either filename could not be determined or content is not a string.`);
      }
    }

    if (writePromises.length === 0) {
      // 저장할 파일이 전혀 없는 경우
      console.log('[SAVE] No valid data found for saving.');
    } else {
      // 모든 파일 쓰기 작업을 병렬로 실행
      await Promise.all(writePromises);
    }

    reply.send(); // 성공 시 빈 응답
  } catch (error) {
    server.log.error(error);
    reply.code(500).send({ error: 'Failed to save files.', details: error.message });
  }
});

// ----------------------------------------------------------------------
// /mvix/load 엔드포인트: 개별 파일 -> JSON 로드
// ----------------------------------------------------------------------
server.post('/mvix/load', async (req, reply) => {
  const resultData = {};
  let foundFilesCount = 0;
  const loadKeys = ["RPG Config", "RPG Global"];

  // 요청하신 예시 포맷에 따라 파일 번호 1부터 99까지 시도합니다. (범위는 필요에 따라 조절 가능)
  for (let i = 1; i <= 99; i++) {
    loadKeys.push(`RPG File${i}`);
  }

  try {
    // 모든 잠재적인 파일에 대한 읽기 작업을 병렬로 준비
    const readPromises = loadKeys.map(async (jsonKey) => {
      const fileName = getFileName(jsonKey);

      if (!fileName) {
        // 이 배열에는 'RPG File[n]', 'RPG Config', 'RPG Global'만 있으므로 발생하지 않아야 함
        return;
      }

      const filePath = path.join(SAVE_DIR, fileName);

      if (await isExistingFile(filePath)) {
        foundFilesCount++;
        try {
          const data = await fs.readFile(filePath, 'utf8');
          // 읽기에 성공한 데이터만 최종 결과 객체에 추가
          resultData[jsonKey] = data;
        } catch (error) {
          server.log.error(`Failed to read file ${fileName}:`, error);
        }
      }
    });

    // 모든 읽기 작업을 기다립니다.
    await Promise.all(readPromises);

    if (foundFilesCount === 0) {
      // 시도한 파일 중 하나도 존재하지 않는 경우
      return reply.send('null');
    }

    // 하나 이상의 파일이 존재하여 데이터를 읽었으므로 JSON 응답을 반환
    reply.type('application/json').send(JSON.stringify(resultData));

  } catch (error) {
    server.log.error(error);
    reply.code(500).send({ error: 'Failed to load files.', details: error.message });
  }
});

server.get('/*', async (req, reply) => {
  const found = await findFileCaseInsensitively(path.join(PWD, req.url));
  if (found) {
    const { dir, base } = path.parse(found);

    if (base === 'main.js') {
      const fileContent = (await fs.readFile(found, 'utf8')).replace(/\r/g, '');
      const hash = createHash('sha256').update(fileContent).digest('hex').slice(0, 8);
      const correspondingFilePath = path.join(PATCHES_DIR, `main.${hash}.patch.js`);

      if (await isExistingFile(correspondingFilePath)) {
        return reply.sendFile(`main.${hash}.patch.js`, PATCHES_DIR);
      }
    }

    return reply.sendFile(base, dir);
  }

  const foundIndex = await findFileCaseInsensitively(path.join(PWD, req.url, 'index.html'));
  if (foundIndex) {
    const { dir, base } = path.parse(foundIndex);
    return reply.sendFile(base, dir);
  }

  return reply.status(404).send();
});

try {
  const url = await server.listen({ port: PORT, host: HOST });

  console.log(`Listening on ${url}`);
  open(url);

} catch (err) {
  server.log.error(err);
  process.exit(1);
}
