#!/usr/bin/env node

const program = require('commander');
const beautify = require('js-beautify').js_beautify;
const Bundler = require('./bundler');

const fs = require('fs');
const util = require('util');
const path = require('path');

const writeFileP = util.promisify(fs.writeFile);
const readFileP = util.promisify(fs.readFile);

const topFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'top.txt'), 'utf8');
const botFile =  fs.readFileSync(path.resolve(__dirname, 'templates', 'bottom.txt'), 'utf8');

program
	.version('0.0.1')
	.usage('<file> [options]')
	.option('-o, --output <file>', 'output file')

program.parse(process.argv);

if (program.args.length === 0) program.help()

const b = new Bundler({ 
    inputFile: program.args[0]
});

fs.writeFileSync(program.output, beautify(b.getBundle(topFile, botFile), {indent_size: 4}), 'utf-8')

process.exit(0)