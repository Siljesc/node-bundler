#!/usr/bin/env node

const program = require('commander');
const Bundler = require('./bundler');

function list(val) {
    return val.split(',');
}

program
	.version('0.0.1')
	.usage('<file> [options]')
    .option('-o, --output <file>', 'output file')
    .option('-v, --verbose', 'enable verbose')
    .option('-b, --beautify', 'beautify output')
    .option('-i, --ignore <files> example: bundle index.js -i file1.js,lib/file2.js', 'ignore files', list)
    .option('-j, --ignoreJSON', 'ignore json files')

program.parse(process.argv);

console.log(program.ignore);

if (program.args.length === 0) program.help()

const b = new Bundler({ 
    inputFile: program.args[0],
    outputFile: program.output,
    verbose: program.verbose,
    beautify: program.beautify,
    ignoreFiles: program.ignore,
    disableJSON: program.ignoreJSON
});

b.saveFile();

process.exit(0)