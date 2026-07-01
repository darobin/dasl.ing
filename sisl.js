#!/usr/bin/env node
import { argv, exit } from 'node:process';
import { dirname, basename, join } from 'node:path';
import { rm, readFile, writeFile, readdir } from 'node:fs/promises';
import chokidar from 'chokidar';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import Turndown from 'turndown';

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
    this.turnDown = new Turndown({
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      headingStyle: 'atx',
    });
    this.turnDown.addRule('meta-abstract', {
      filter: (n) => n.localName === 'table' && n.parentElement?.localName === 'header',
      replacement: (_, n) => n.querySelector('#abstract')?.textContent,
    });
    this.turnDown.keep(['var', 'dfn']);
    this.turnDown.addRule('references', {
      filter: (n) => n.localName === 'dt' && /^ref-/.test(n.id),
      replacement: (cnt, n) => `<dfn id="${n.id}">${cnt}</dfn>`,
    });
  }
  async watch () {
    // For reasons that baffle me, chokidar's ignored option doesn't work correctly. So
    // we filter ourselves.
    const buildIfMatch = (path) => {
      if (basename(path) !== 'bibliography.json' && basename(path) !== 'people.json' && !path.endsWith('.src.html')) return;
      this.build();
    };
    const removeIfMatch = (path) => {
      if (!path.endsWith('.src.html')) return;
      this.removeSpec(path);
    };
    chokidar
      .watch(this.baseDir, {
        depth: 0,
        ignoreInitial: true,
      })
      .on('add', (path) => buildIfMatch(path))
      .on('change', (path) => buildIfMatch(path))
      .on('unlink', (path) => removeIfMatch(path))
      .on('ready', () => this.build())
    ;
  }
  async build () {
    // load data
    const bibliography = await loadJSON(this.baseDir, 'bibliography');
    const people = await loadJSON(this.baseDir, 'people');
    // list specs
    const specs = {};
    const specList = (await readdir(this.baseDir)).filter(f => /\.src\.html$/.test(f));
    for (const s of specList) {
      const dom = new JSDOM(await readFile(s, 'utf8'));
      const { window: { document: doc } } = dom;
      const meta = doc.querySelector('meta[name="authors"]');
      const authors = meta?.getAttribute('content')?.split(/\s*,\s*/) || ['robin', 'bumblefudge'];
      if (meta) meta.remove();
      specs[basename(s).replace(/\.src\.html$/, '')] = { dom, doc, authors };
    }
    // extract metadata from all src and add to biblio
    Object.keys(specs).forEach(shortname => {
      bibliography[shortname] = this.htmlifyReference({
        author: joinList(specs[shortname].authors.map(au => people[au].name)),
        title: specs[shortname].doc.title,
        date: today(),
        url: `https://dasl.ing/${shortname}.html`,
      });
    });
    for (const shortname of Object.keys(specs)) {
      const { dom, doc, authors } = specs[shortname];
      const el = makeEl(doc);
      console.warn(`--- Processing ${shortname} "${doc.title}" (${doc.body.innerHTML.length}) ---`);
      // css
      const abstract = doc.querySelector('#abstract');
      if (!abstract) err(`Missing abstract in ${doc.title}`);
      const head = doc.querySelector('head');
      const cmt = doc.createComment(`

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!   GENERATED SPEC — DO NOT EDIT. Look for the .src.html instead   !!!!
!!!!!                                                                  !!!!
!!!!!   HEY YOU                                                        !!!!
!!!!!   YES ***YOU****!                                                !!!!
!!!!!                                                                  !!!!
!!!!!   You're about to edit a generated document.                     !!!!
!!!!!   Don't do that! Why would you do that.                          !!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

`);
      head.prepend(doc.createTextNode('\n\n'), cmt, doc.createTextNode('\n\n'));
      el('link', { rel: 'stylesheet', href: 'spec.css' }, [], head);
      el('link', { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect x=%220%22 y=%220%22 width=%22100%22 height=%22100%22 fill=%22%2300ff75%22></rect></svg>' }, [], head);
      el('link', { rel: 'alternate', type: 'text/markdown', href: `https://dasl.ing/${shortname}.md` }, [], head);
      el('meta', { name: 'twitter:card', content: 'summary_large_image' }, [], head);
      el('meta', { name: 'twitter:title', property: 'og:title', content: `DASL: ${doc.title}` }, [], head);
      if (abstract) el('meta', { name: 'twitter:description', property: 'og:description', content: norm(abstract.textContent) }, [], head);
      el('meta', { name: 'twitter:image', property: 'og:image', content: `https://dasl.ing/${shortname}.png` }, [], head);
      el('meta', { name: 'twitter:image:alt', content: 'Very colourful stripes, so colourful it hurts' }, [], head);
      el('meta', { name: 'twitter:url', property: 'og:url', content: 'https://dasl.ing/' }, [], head);
      el('meta', { property: 'og:site_name', content: 'DASL' }, [], head);
      el('meta', { property: 'og:locale', content: 'en' }, [], head);
      el('meta', { name: 'theme-color', content: '#00ff75' }, [], head);

      // main & header
      const main = doc.createElement('main');
      const header = el('header', {}, [el('h1', {}, [doc.title])], main);
      const attribution = [];
      authors
        .map(au => people[au])
        .forEach(({ site, name, email }, idx) => {
          if (idx) attribution.push(el('br'));
          attribution.push(el('a', { href: site }, [name]),
            ' <', el('a', { href: `mailto:${email}` }, [email]), '>');
        })
      el(
        'table',
        {},
        [
          el('tr', {}, [
            el('th', {}, ['date']),
            el('td', {}, [today()]),
          ]),
          el('tr', {}, [
            el('th', {}, ['editors']),
            el('td', {}, attribution),
          ]),
          el('tr', {}, [
            el('th', {}, ['issues']),
            el('td', {}, [
              el('a', { href: 'https://github.com/darobin/dasl.ing/issues' }, ['list']),
              ', ',
              el('a', { href: 'https://github.com/darobin/dasl.ing/issues/new' }, ['new']),
            ]),
          ]),
          el('tr', {}, [
            el('th', {}, ['abstract']),
            el('td', {}, [abstract]),
          ]),
        ],
        header
      );
      main.append(...doc.body.childNodes);
      doc.body.append(main);
      // nav back
      const bk = el('div', { class: 'nav-back' }, [
        'A specification of the ',
        el('a', { href: '/' }, ['DASL Project']),
        '.'
      ]);
      doc.body.prepend(bk);
      // definitions & xrefs
      [...doc.querySelectorAll('dfn')].forEach(dfn => {
        const id = slugify(doc, dfn, 'dfn', true);
        dfn.setAttribute('id', id);
      });
      [...doc.querySelectorAll('a:not([href])')].forEach(a => {
        const id = slugify(doc, a, 'dfn');
        if (doc.getElementById(id)) {
          a.setAttribute('href', `#${id}`);
          a.className = 'dfn-ref';
        }
        else {
          err(`Empty link "${a.textContent}" (#${id}) has no matching dfn.`);
        }
      });
      // references
      const refs = {};
      main.innerHTML = main.innerHTML.replace(
        /\[\[([\w-]+)\]\]/g,
        (_, ref) => {
          if (!bibliography[ref]) {
            err(`No "${ref}" entry in the bibliography.`);
            return `[[${ref}]]`;
          }
          refs[ref] = bibliography[ref];
          return `[<a href="#ref-${ref}" class="ref">${ref}</a>]`;
        }
      );
      if (Object.keys(refs).length) {
        const refSec = el('section', {}, [el('h2', {}, ['References'])], main);
        const dl = el('dl', {}, [], refSec);
        Object.keys(refs).sort().forEach(r => {
          el('dt', { id: `ref-${r}` }, [`[${r}]`], dl);
          const dd = el('dd', {}, [], dl);
          dd.innerHTML = refs[r];
        });
      }
      // save
      await writeFile(join(this.baseDir, `${shortname}.html`), dom.serialize());
      // make some MD
      await writeFile(join(this.baseDir, `${shortname}.md`), this.turnDown.turndown(doc.body.querySelector('main')));
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
}

function err (str) {
  console.error(chalk.red(str));
}
function die (str) {
  err(str);
  exit(1);
}


function makeEl (doc) {
  return (n, attr, kids, parent) => {
    const el = doc.createElement(n);
    if (attr) Object.keys(attr).forEach((k) => el.setAttribute(k, attr[k]));
    if (kids) {
      kids.forEach(k => {
        if (typeof k === 'string') k = doc.createTextNode(k);
        el.append(k);
      });
    }
    if (parent) parent.append(el);
    return el;
  };
}

function slugify (doc, el, pfx, unique) {
  if (el.hasAttribute('id')) return el.getAttribute('id');
  let suf;
  const txt = (norm(el.textContent) || 'empty').toLowerCase().replace(/\W/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  const idify = () => [pfx, txt, suf].filter(Boolean).join('-');
  let id = idify();
  if (unique) {
    while (doc.getElementById(id)) {
      if (!suf) suf = 0;
      suf++;
      id = idify();
    }
  }
  return id;
}

function today () {
  return new Date().toISOString().replace(/T.+/, '');
}

function esc (str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function norm (str) {
  return (str || '').replace(/\s/g, ' ').replace(/^\s+|\s+$/g, '');
}

const isWatch = argv[2] === '--watch';
const sisl = new SISL(dirname(new URL(import.meta.url).toString().replace(/^file:\/\//, '')));
if (isWatch) sisl.watch();
else sisl.build();

async function loadJSON (baseDir, base) {
  try {
    return JSON.parse(await readFile(join(baseDir, `${base}.json`)));
  }
  catch (e) {
    die(e.message);
  }
}

function joinList (authors) {
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return authors.join(' & ');
  return authors.map((au, idx) => {
    if (idx === (authors.length - 1)) return `& ${au}`;
    return au;
  }).join(', ');
}
