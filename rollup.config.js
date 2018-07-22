var buble = require('rollup-plugin-buble');
var resolve = require('rollup-plugin-node-resolve');
var commonjs = require('rollup-plugin-commonjs');

module.exports = {
    input: 'src/index.mjs',
    output: {
        file: 'dist/index.js',
        format: 'umd',
        name: 'bitten',
        sourcemap: true
    },
    plugins: [
        resolve({
            jsnext: true,
            main: true,
            browser: true,
            preferBuiltins: false,
        }),
        commonjs(),
        buble({
            objectAssign: 'Object.assign',
            transforms: {
                templateString: false,
            },
        }),
    ],
    watch: {
        include: 'src/**'
    }
};
