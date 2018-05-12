#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const util = require('util');
const uid = require('uuid');
const vm = require('vm');
const Module = require('module');
const beautify = require('js-beautify').js_beautify;

let AppExport = {};

const topFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'top.txt'), 'utf8');
const botFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'bottom.txt'), 'utf8');

class Bundler {

	constructor(options){
		this._scopes = {};
		this._scopesCache = {};
		this._scopesRaw = {};
		this.inputFile = options.inputFile;
		this.beautify = options.beautify;
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

		if(requirePath.startsWith('../')) filePath = path.normalize(filePath);
		if(!requirePath.endsWith('.js') && !requirePath.endsWith('.json')) requirePath += '.js'

		let fixedPath = path.join(path.parse(filePath).dir, requirePath);

		const length = path.resolve(process.cwd()).length
		fixedPath = (('./'+fixedPath.slice(length+1)).replace(/\\/g, '/'));

		return fixedPath;
	}

	__scopeRequire(mod, filePath){

		const Module = mod.constructor

		const _require = (requirePath) => {

			// File is requiring module from node_modules
			if(!requirePath.startsWith('./') && !requirePath.startsWith('../')) return mod.require(requirePath);
			
			// File Path relative to root dir
			const fixedPath = Bundler.fixPath(filePath, requirePath);
			
			// Avoid re-running module 
			if(this._scopesCache[fixedPath]) return this._scopesCache[fixedPath];
			
			this.debug(`Reading ${fixedPath} required by ${filePath}`);
			const file = String(fs.readFileSync(fixedPath, 'utf-8'));

			const wrappedFile = Bundler.generateScopeFile(fixedPath, file);
			
			this._scopes[fixedPath] = wrappedFile;

			// We need to write it to file later
			this._scopesRaw[fixedPath] = file;
			
			const compiledWrapper = vm.runInThisContext(wrappedFile);
			const requiredFile = this.__scope(fixedPath, compiledWrapper);

			this._scopesCache[fixedPath] = requiredFile;

			return requiredFile;
		}

		_require.cache = Module._cache;

		return _require;
	}

	__scope(_path, fun){

		const _mod = module;
		const _module = new _mod.constructor();

		_path = path.resolve(_path);
		const _filename = _path;
		const _dirname = path.dirname(_filename);

		_module.paths = module.paths;

		const _require = this.__scopeRequire(_mod, _path);

		let result = fun.call(_module.exports, _module.exports, _require, _module, _dirname, _filename); 

		return _module.exports;
	}

	concatScopes(){
		return Object.keys(this._scopesRaw).map((scope) => {
			this.debug(`Adding ${scope} to bundle`);
			return (`__scopes["${scope}"] = function(){ return ${Bundler.generateScopeFile(scope, this._scopesRaw[scope])} }`)
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

		this.__scope('init', (exports, require, module) => {
			require('./'+this.inputFile)
		});

		console.log(`Bundling Files...`)

		return this.concatScopes();
	}

	saveFile(output){
		console.log(`Saving File...`);

		let bundle = this.getBundle(topFile, botFile)

		if(this.beautify) bundle = beautify(bundle, { indent_size: 4 });

		fs.writeFileSync(output, bundle, 'utf-8');

		console.log(`Saved file ${output}!`);

		process.exit(0)
	}
}

module.exports = Bundler;