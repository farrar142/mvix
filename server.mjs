#!/usr/bin/env node

import path from 'path';
import open from 'open';
import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import { findFileCaseInsensitively, isExistingFile } from './utils.mjs';

/* eslint-disable no-console */

if (!(await isExistingFile('index.html'))) {
  console.error('Please run mvix in the game folder.');
  process.exit(1);
}

const PWD = process.cwd();
const DEBUG_MODE = Boolean(process.env.DEBUG);
const PORT = Number(process.env.PORT ?? 3000);

const server = Fastify({ logger: DEBUG_MODE });

server.register(FastifyStatic, {
  root: PWD,
  index: false,
  prefix: '/static/', // FIXME: workaround to FastifyError: Method 'HEAD' already declared for route '/*'
});

server.get('/*', async(req, reply) => {
  const found = await findFileCaseInsensitively(path.join(PWD, req.url));
  if (found) {
    const { dir, base } = path.parse(found);
    return reply.sendFile(base, dir);
  }

  const foundIndex = await findFileCaseInsensitively(path.join(PWD, req.url, 'index.html'));
  if (foundIndex) {
    const { dir, base } = path.parse(foundIndex);
    return reply.sendFile(base, dir);
  }

  reply.status(404);
});

try {
  const url = await server.listen({ port: PORT });

  console.log(`Listening on ${url}`);
  open(url);

} catch (err) {
  server.log.error(err);
  process.exit(1);
}
