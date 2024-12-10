#!/usr/bin/env node
import { argv, exit } from 'node:process';
import { dirname, basename, join } from 'node:path';
import { rm, readFile, writeFile, readdir } from 'node:fs/promises';
import chokidar from 'chokidar';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';

// SISL — Simple Implementation of a Specification Language
// This is just a basic spec generator. Here's what it does:
//  - Watches *.src.html to know which specs to generate.
//  - Pulls metadata from those specs so they can reference one another.
//  - Watches bibliography.json for references that specs can use.
//  - Parses [[ref]] as a reference.
//  - Manages metadata and styling for specs.
//  - Creates anchors for definitions and the such

class SISL {
  constructor (dir) {
    this.baseDir = dir;
  }
  async watch () {
    // For reasons that baffle me, chokidar's ignored option doesn't work correctly. So
    // we filter ourselves.
    const buildIfMatch = (path) => {
      if (basename(path) !== 'bibliography.json' && !path.endsWith('.src.html')) return;
      this.build();
    };
    const removeIfMatch = (path) => {
      if (!path.endsWith('.src.html')) return;
      this.removeSpec(path);
    };
    chokidar
      .watch(this.baseDir, {
        depth: 0,
      })
      .on('add', (path) => buildIfMatch(path))
      .on('change', (path) => buildIfMatch(path))
      .on('unlink', (path) => removeIfMatch(path))
    ;
  }
  async build () {
    // load the bibliography
    try {
      this.bibliography = JSON.parse(await readFile(join(this.baseDir, 'bibliography.json')));
    }
    catch (err) {
      this.die(err.message);
    }
    // list specs
    const specs = {};
    const specList = (await readdir(this.baseDir)).filter(f => /\.src\.html$/.test(f));
    for (const s of specList) {
      const dom = new JSDOM(await readFile(s, 'utf8'));
      const { window: { document: doc } } = dom;
      specs[basename(s).replace(/\.src\.html$/, '')] = { dom, doc};
    }
    // extract metadata from all src and add to biblio
    Object.keys(specs).forEach(shortname => {
      this.bibliography[shortname] = this.htmlifyReference({
        author: 'Robin Berjon & Juan Caballero',
        title: specs[shortname].doc.title,
        date: new Date().toISOString().replace(/T.+/, ''),
        url: `https://dasl.ing/${shortname}.html`,
      });
    });
    for (const shortname of Object.keys(specs)) {
      const { dom } = specs[shortname];
      await writeFile(join(this.baseDir, `${shortname}.html`), dom.serialize());
    }
  }
  async removeSpec (absPath) {
    await rm(this.srcToSpec(absPath));
  }
  htmlifyReference ({ author, title, date, url }) {
    return `${esc(author)}. <a href="${esc(url)}"><cite>${esc(title)}</cite></a>. ${esc(date)}. URL:&nbsp;<a href="${esc(url)}">${esc(url)}</a>`
  }
  srcToSpec (path) {
    return path.replace(/\.src\.html$/, '.html');
  }
  err (str) {
    console.error(chalk.red(str));
  }
  die (str) {
    this.err(str);
    exit(1);
  }
}

function esc (str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

const isWatch = argv[2] === '--watch';
const sisl = new SISL(dirname(new URL(import.meta.url).toString().replace(/^file:\/\//, '')));
if (isWatch) sisl.watch();
else sisl.build();
