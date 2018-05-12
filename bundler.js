#!/usr/bin/env node

'use strict';
const program = require('commander');

const __path = require('path');
const __fs = require('fs');
const __util = require('util');
const uid = require('uuid');

let AppExport = {};

const __writeFileP = __util.promisify(__fs.writeFile);
const __readFileP = __util.promisify(__fs.readFile);

const writeJSFile = async function(path, file){
	try {
		await __writeFileP(path, file, 'utf-8');
		return console.log(`Saved ${path}`); 
	} catch (err){
		console.log(err)
	}
}

const __scopeFile = function(__scope, string){	
	if(__scope.endsWith('.json')) return `__scope('${__scope}', function(){\n\tmodule.exports = ${string}\n})`
	let file = `__scope('${__scope}', function(require, module, exports){\n\t${string}\n	module = Object.keys(module).length ? module : {exports};`;
	if(__scope = `./app.js`) file += `\n AppExport = module`;
	file += `\nreturn module\n})`;
	return file;
}

const __scopes = {};
const __scopesCache = {};
const __scopestrings = {};
const __scopeOrder = [];

const __scopeRequire = function(oPath, path){
	
	const parsedPath = __path.parse(oPath);
	
	if(parsedPath.name.length === 13) oPath = './' + parsedPath.name;
	//if(__scopes[oPath]) return eval(__scopes[oPath]);
	
	if((!path.startsWith('./') && !path.startsWith('../'))) {
		return require(path);
	}
	
	if(path.startsWith('../')) oPath = __path.normalize(oPath);
	if(!path.endsWith('.js') && !path.endsWith('.json')) path += '.js'
	
	let filePath = __path.join(__path.parse(oPath).dir, path);
	
	const length = __path.resolve(process.cwd()).length
	filePath = (('./'+filePath.slice(length+1)).replace(/\\/g, '/'));
	
	if(__scopesCache[filePath]) return __scopesCache[filePath];
	
	let file = String(__fs.readFileSync(filePath));
	
	__scopes[filePath] = __scopeFile(filePath, file);
	__scopestrings[filePath] = file;
	__scopeOrder.push(filePath);
	
	const requiredFile = eval(__scopeFile(filePath, file));
	__scopesCache[filePath] = requiredFile;
	return requiredFile;
}

const __scope = function(path, fun){
	path = __path.resolve(path);

	const _resolved = fun(__scopeRequire.bind(null, path), {}, {})
	if(_resolved) return _resolved.exports
}

const print__scopes = function(){
	return __scopeOrder.reverse().map((___scope) => `__scopes["${___scope}"] = function(){ return ${__scopeFile(___scope, __scopestrings[___scope])} }`).join(';\n\n');
}

const jsFile = `const __path = require('path');
const __scopes = {};
const __scopesCache = {};
let AppExport = {};

const __scopeRequire = function(oPath, path){
	
	if(!path.startsWith('./') && !path.startsWith('../')) {
		return require(path);
	}
	
	if(path.startsWith('../')) oPath = __path.normalize(oPath);
	if(!path.endsWith('.js') && !path.endsWith('.json')) path += '.js'
	
	let filePath = __path.join(__path.parse(oPath).dir, path);
	
	const length = __path.resolve(process.cwd()).length
	filePath = (('./'+filePath).replace(/\\\\/g, '/'));
	
	if(__scopesCache[filePath]) return __scopesCache[filePath];
	
	const requiredFile = __scopes[filePath] && __scopes[filePath]();
	
	if(!requiredFile) throw new Error("Couldn't find module: "+filePath)
	
	__scopesCache[filePath] = requiredFile;
	return requiredFile;
}

const __scope = function(path, fun){
	const _resolved = fun(__scopeRequire.bind(null, path), {}, {})
	if(_resolved) return _resolved.exports
}

${print__scopes()}

__scope('init', function(require, module){
	require('./app.js')
})

module.exports = AppExport.exports;
`;

const init = async (input, output) => {

	__scope('init', function(require, module){
		require(`./${input}`);
	})
	
	await writeJSFile(__path.resolve(process.cwd(), output), jsFile);
	
	process.exit(0)
};

program
	.version('0.0.1')
	.usage('<file> [options]')
	.option('-o, --output <file>', 'bundle file')

program.parse(process.argv);

if (program.args.length === 0) program.help()
	
init(program.args[0], program.output)