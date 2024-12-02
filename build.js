#!/usr/bin/env node
import { argv } from 'node:process';
import * as esbuild from 'esbuild';

const isWatch = argv[2] === '--watch';
const options = {
  entryPoints: ['bsky-comments.js'],
  bundle: true,
  outfile: 'bsky-comments.min.js',
  format: 'esm',
  sourcemap: isWatch,
  // plugins: [wasmLoader()],
};

if (isWatch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
}
else {
  esbuild.build(options);
}
