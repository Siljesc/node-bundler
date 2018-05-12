#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const Module = require('module');
const beautify = require('js-beautify').js_beautify;

const topFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'top.txt'), 'utf8');
const botFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'bottom.txt'), 'utf8');

const REGEX_REQ_G = /require\(['|"](.*)['|"]\)/g;
const REGEX_REQ = /require\(['|"](.*)['|"]\)/;

class Bundler {

	constructor(options){
		this._scopes = {};
		this.inputFile = options.inputFile;
		this.minify = options.minify;
		this.beautify = options.beautify;
		this.outputFile = options.outputFile || 'bundle.js';
		this.debug = options.verbose ? (...args) => console.log(...args) : () => null;
	}

	static scopeFileJS(string, main){
		return `${ string }\n\t${main ? `\n\t AppExport = module;` : ''}`;
	}

	static scopeFileJSON(string){
		return `module.exports = ${ string }`;
	}

	static generateScopeFile(scope, string){
		let file = ''

		if(scope.endsWith('.json')) file = Bundler.scopeFileJSON(string);
		else file = Bundler.scopeFileJS(string, scope === './app.js');

		return Module.wrap(file);
	}

	static fixPath(filePath, requirePath){

		filePath = path.normalize(filePath);
		if(!requirePath.endsWith('.js') && !requirePath.endsWith('.json')) requirePath += '.js'

		let fixedPath = path.join(path.parse(filePath).dir, requirePath);

		fixedPath = (('./'+fixedPath).replace(/\\/g, '/'));

		return fixedPath;
	}

	static findRequires(file){

		const requires = file.match(REGEX_REQ_G)
		return !requires ? [] : file.match(REGEX_REQ_G).map((string) => string.match(REGEX_REQ)[1]);
	}

	processFile(filePath){

		if(this._scopes[filePath]) return;

		this.debug(`Processing ${filePath}`);

		const file = String(fs.readFileSync(filePath, 'utf-8'));
		const fileRequires = Bundler.findRequires(file);

		if(!filePath.startsWith('./')) filePath = './'+filePath;

		this._scopes[filePath] = file;

		fileRequires.forEach((requirePath) => {

			// File is requiring module from node_modules
			if(!requirePath.startsWith('./') && !requirePath.startsWith('../')) return;

			// File Path relative to root dir
			const fixedPath = Bundler.fixPath(filePath, requirePath);

			this.processFile(fixedPath);
		})

		return;

	}

	concatScopes(){
		return Object.entries(this._scopes).map(([scope, string]) => {
			this.debug(`Adding ${scope} to bundle`);
			return (`__scopes["${scope}"] = function(){ return ${Bundler.generateScopeFile(scope, string)} }`)
		}).join(';\n\n');;
	};

	getBundle(pre, after){
		return pre + 
			'\n\n' + 
			this.init() + 
			'\n\n' + 
			`__scope('init', (exports, require, module) => {
				require('./${this.inputFile}')
			});`+
			after;
	}

	init(){

		console.log(`Processing Files...`)

		this.processFile(this.inputFile);

		console.log(`Bundling Files...`)

		return this.concatScopes();
	}

	saveFile(){
		console.log(`Saving File...`);

		let bundle = this.getBundle(topFile, botFile)

		if(this.beautify) bundle = beautify(bundle, { indent_size: 4 });

		fs.writeFileSync(this.outputFile, bundle, 'utf-8');

		console.log(`Saved file ${this.outputFile}!`);

		process.exit(0)
	}
}

module.exports = Bundler;