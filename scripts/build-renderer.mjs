#!/usr/bin/env node
/**
 * Builds the renderer (Ext JS UI) without Sencha Cmd.
 *
 * Output (build/renderer/):
 *   ext-all.js   prebuilt Ext JS framework (copied from ext/build)
 *   ext-locale/  Ext JS translations, loaded at runtime for the chosen language (app/Application.js)
 *   app.js       theme JS overrides + Ext locale + required Ext.ux classes + overrides/ + app/ + app.js,
 *                ordered so that every class is defined after the classes it depends on
 *
 * The theme CSS is prebuilt and committed in resources/LibreRambox-all.css (with
 * resources/images and resources/fonts), so no Sass/Compass step is needed.
 *
 * Usage: node scripts/build-renderer.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'build', 'renderer');

const FRAMEWORK = 'ext/build/ext-all-rtl.js';
const FRAMEWORK_LOCALE = 'ext/packages/ext-locale/build/ext-locale-en.js';
// JS overrides of the theme chain (librerambox-default-theme -> crisp -> neptune), e.g. borderless panels
const THEME_OVERRIDES = [
	'ext/packages/ext-theme-crisp/build/ext-theme-crisp.js',
	'packages/local/librerambox-default-theme/overrides/init.js',
];
const UX_SOURCE_DIR = 'ext/src/ux';
// Ext.ux classes are not part of ext-all; these are used by the app (some only via xtype)
const UX_CLASSES = ['Ext.ux.TabReorderer', 'Ext.ux.statusbar.StatusBar'];
const APP_NAMESPACE = 'LibreRambox';
const SOURCE_DIRS = ['overrides', 'app'];
const ENTRY = 'app.js';

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const listJs = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
	.flatMap((entry) => {
		const rel = path.posix.join(dir, entry.name);
		if ( entry.isDirectory() ) return listJs(rel);
		return entry.name.endsWith('.js') ? [rel] : [];
	})
	.sort();

// Extracts the string(s) of a config property: `name: 'A'` or `name: ['A', 'B']`
const stringsOf = (source, name) => {
	const result = [];
	const re = new RegExp(`[,{\\s]${name}\\s*:\\s*(\\[[^\\]]*\\]|'[^']*'|"[^"]*")`, 'g');
	let match;
	while ( (match = re.exec(source)) ) {
		for ( const s of match[1].matchAll(/'([^']*)'|"([^"]*)"/g) ) result.push(s[1] ?? s[2]);
	}
	return result;
};

// Parses a source file: the class it defines, its aliases and what it needs at define time
const parse = (file) => {
	const source = read(file);
	const name = (source.match(/Ext\.define\(\s*['"]([^'"]+)['"]/) || [])[1] || null;
	const aliases = [
		...stringsOf(source, 'alias'),
		...stringsOf(source, 'xtype').slice(0, 1).map((x) => 'widget.' + x),
	];
	const deps = [
		...stringsOf(source, 'extend'),
		...stringsOf(source, 'override'),
		...stringsOf(source, 'requires'),
		...stringsOf(source, 'mixins'),
		...stringsOf(source, 'model'),
		// Ext.app.Application / Controller short names: stores: ['Services'] -> LibreRambox.store.Services
		...['stores', 'models', 'views', 'controllers', 'profiles'].flatMap((key) =>
			stringsOf(source, key).map((s) => s.includes('.') ? s : `${APP_NAMESPACE}.${key.replace(/s$/, '')}.${s}`)
		),
	];
	// controller: 'alias' / viewModel: 'alias' or { type: 'alias' } refer to classes by alias
	const aliasDeps = [
		...stringsOf(source, 'controller').map((a) => 'controller.' + a),
		...(source.match(/viewModel\s*:\s*\{\s*type\s*:\s*['"]([^'"]+)['"]/g) || [])
			.map((m) => 'viewmodel.' + m.match(/['"]([^'"]+)['"]\s*$/)[1]),
		...stringsOf(source, 'viewModel').map((a) => 'viewmodel.' + a),
	];
	return { file, source, name, aliases, deps, aliasDeps };
};

// Collects Ext.ux classes (and the Ext.ux classes they require) from the framework sources
const collectUx = (classNames, seen = new Map()) => {
	for ( const className of classNames ) {
		if ( seen.has(className) ) continue;
		const file = path.posix.join(UX_SOURCE_DIR, className.replace(/^Ext\.ux\./, '').split('.').join('/') + '.js');
		if ( !fs.existsSync(path.join(root, file)) ) throw new Error(`Cannot find ${className} (${file})`);
		const info = parse(file);
		seen.set(className, info);
		collectUx(info.deps.filter((d) => d.startsWith('Ext.ux.')), seen);
	}
	return seen;
};

const modules = [
	...collectUx(UX_CLASSES).values(),
	...SOURCE_DIRS.flatMap(listJs).map(parse),
];

const byName = new Map(modules.filter((m) => m.name).map((m) => [m.name, m]));
const byAlias = new Map(modules.flatMap((m) => m.aliases.map((a) => [a, m])));

// Depth-first topological sort, keeping the original order where there are no dependencies
const ordered = [];
const state = new Map();
const visit = (mod, trail) => {
	if ( state.get(mod) === 'done' ) return;
	if ( state.get(mod) === 'visiting' ) throw new Error('Circular dependency: ' + [...trail, mod.file].join(' -> '));
	state.set(mod, 'visiting');
	const deps = [
		...mod.deps.map((d) => byName.get(d)),
		...mod.aliasDeps.map((a) => byAlias.get(a)),
	].filter((d) => d && d !== mod);
	for ( const dep of deps ) visit(dep, [...trail, mod.file]);
	state.set(mod, 'done');
	ordered.push(mod);
};
modules.forEach((mod) => visit(mod, []));

// Report dependencies on app classes that don't exist (typos, deleted files)
for ( const mod of modules ) {
	for ( const dep of mod.deps ) {
		if ( dep.startsWith(APP_NAMESPACE + '.') && !byName.has(dep) ) {
			throw new Error(`${mod.file} requires unknown class ${dep}`);
		}
	}
}

const banner = (file) => `\n/* ---- ${file} ---- */\n`;
const bundle = [
	'/* Generated by scripts/build-renderer.mjs - do not edit */',
	...THEME_OVERRIDES.map((file) => banner(file) + read(file)),
	banner(FRAMEWORK_LOCALE) + read(FRAMEWORK_LOCALE),
	// All classes are bundled, so dynamic loading must never kick in
	'\nExt.Loader.setConfig({ enabled: false });\n',
	...ordered.map((mod) => banner(mod.file) + mod.source),
	banner(ENTRY) + read(ENTRY),
].join('\n');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(root, FRAMEWORK), path.join(outDir, 'ext-all.js'));
const localeDir = path.join(root, path.dirname(FRAMEWORK_LOCALE));
fs.mkdirSync(path.join(outDir, 'ext-locale'));
for ( const file of fs.readdirSync(localeDir).filter((f) => /^ext-locale-[\w-]+\.js$/.test(f) && !f.endsWith('-debug.js')) ) {
	fs.copyFileSync(path.join(localeDir, file), path.join(outDir, 'ext-locale', file));
}
fs.writeFileSync(path.join(outDir, 'app.js'), bundle);

console.log(`Renderer built: ${path.relative(root, outDir)}/ (${ordered.length} files bundled)`);
