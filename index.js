#!/usr/bin/env node

const program = require('commander');
const Bundler = require('./bundler');

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
    outputFile: program.output,
    verbose: program.verbose,
    beautify: program.beautify
});

b.saveFile();

process.exit(0)