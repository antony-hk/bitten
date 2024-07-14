import esbuild from "esbuild";

const baseConfig = {
    entryPoints: ["src/index.js"],
    bundle: true,
    logLevel: "info"
};

const umdConfig = {
    ...baseConfig,
    format: "iife",
    globalName: "bitten",
};

const esmConfig = {
    ...baseConfig,
    format: "esm",
};

esbuild.build({
    ...umdConfig,
    outfile: "dist/bitten.js",
});

esbuild.build({
    ...esmConfig,
    outfile: "dist/bitten.mjs",
});
