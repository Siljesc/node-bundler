#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const Module = require('module');
const beautify = require('js-beautify').js_beautify;
const zip = require('node-zip')();

const topFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'top.txt'), 'utf8');
const botFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'bottom.txt'), 'utf8');

const REGEX_REQ_G = /require\(['|"](.*)['|"]\)/g;
const REGEX_REQ = /require\(['|"](.*)['|"]\)/;

class Bundler {

	constructor(options){
		this._scopes = {};
		this._assets = {};
		this.inputFile = options.inputFile;
		this.minify = options.minify;
		this.beautify = options.beautify;
		this.outputFile = options.outputFile || 'bundle.js';
		this.ignoreFiles = options.ignoreFiles || [];
		this.disableJSON = options.disableJSON || false;
		this.debug = options.verbose ? (...args) => console.log(...args) : () => null;
		this.zip = options.zip || false;
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

	processFile(filePath, entry){

		if(this._scopes[filePath]) return;

		if(this.ignoreFiles.includes(filePath)) {
			if(!zip || this._assets[filePath]) return;
			this._assets[filePath] = String(fs.readFileSync(filePath, 'utf-8'));
		}

		if(filePath.includes('.json') && this.disableJSON) return;

		this.debug(`Processing ${filePath}`);

		const file = String(fs.readFileSync(filePath, 'utf-8'));
		const fileRequires = Bundler.findRequires(file);

		if(entry) {
			const parsedPath = path.parse(filePath);

			// Use absolute path in case of different paths between input and output
			this.outputFile = path.resolve(process.cwd(), this.outputFile);

			this.ignoreFiles = this.ignoreFiles.map((fpath) => '.'+fpath.replace(new RegExp(parsedPath.dir), ''));

			filePath = parsedPath.base;
			process.chdir(parsedPath.dir);
		}


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
				require('./${path.parse(this.inputFile).base}')
			});`+
			after;
	}

	init(){

		console.log(`Processing Files...`)

		this.processFile(this.inputFile, true);

		console.log(`Bundling Files...`)

		return this.concatScopes();
	}

	saveFile(){
		console.log(`Saving File...`);

		let bundle = this.getBundle(topFile, botFile)
		let encoding = 'utf-8'

		if(this.beautify) bundle = beautify(bundle, { indent_size: 4 });
		
		if(this.zip){

			let pjson = '';
			
			try {
				pjson = JSON.stringify(fs.readFileSync('package.json', 'utf-8'));
			} catch(err){
				try {
					pjson = JSON.stringify(fs.readFileSync('../package.json', 'utf-8'));
				} catch(err){
					pjson = false;
				}
			}

			zip.file(path.parse(this.outputFile).base, bundle);
			if(pjson) zip.file('package.json', pjson);

			Object.entries(this._assets).forEach(([fpath, ftext]) =>  zip.file(fpath.replace(/\.\//, ''), ftext));

			encoding = 'binary';
			bundle = zip.generate({base64:false,compression:'DEFLATE'});

			this.outputFile += '.zip';
		}

		fs.writeFileSync(this.outputFile, bundle, encoding);

		console.log(`Saved file ${this.outputFile}!`);

		process.exit(0)
	}
}

module.exports = Bundler;