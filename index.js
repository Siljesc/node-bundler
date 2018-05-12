#!/usr/bin/env node

const program = require('commander');
const beautify = require('js-beautify').js_beautify;
const Bundler = require('./bundler');

const fs = require('fs');
const util = require('util');
const path = require('path');

const writeFileP = util.promisify(fs.writeFile);
const readFileP = util.promisify(fs.readFile);

program
	.version('0.0.1')
	.usage('<file> [options]')
    .option('-o, --output <file>', 'output file')
    .option('-v, --verbose', 'enable verbose')
    .option('-b, --beautify', 'beautify output')

program.parse(process.argv);

if (program.args.length === 0) program.help()

const b = new Bundler({ 
    inputFile: program.args[0],
    verbose: program.verbose,
    beautify: program.beautify
});

b.saveFile(program.output);

process.exit(0)