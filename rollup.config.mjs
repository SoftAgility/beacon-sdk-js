import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const input = 'src/index.ts';

const terserOpts = {
  compress: {
    passes: 3,
    pure_getters: true,
    unsafe_arrows: true,
    drop_console: false,
    ecma: 2020,
    booleans_as_integers: true,
    reduce_vars: true,
    collapse_vars: true,
    join_vars: true,
  },
  mangle: {
    properties: { regex: /^_/ },
  },
  format: {
    comments: false,
    ecma: 2020,
  },
};

const ts = () => typescript({ tsconfig: './tsconfig.json', declaration: false });

export default [
  { input, output: { file: 'dist/beacon.esm.js', format: 'es', sourcemap: false }, plugins: [ts(), terser(terserOpts)] },
  { input, output: { file: 'dist/beacon.cjs.js', format: 'cjs', exports: 'named', sourcemap: false }, plugins: [ts(), terser(terserOpts)] },
  { input: 'src/umd-entry.ts', output: { file: 'dist/beacon.umd.js', format: 'umd', name: 'Beacon', exports: 'default', sourcemap: false }, plugins: [ts(), terser(terserOpts)] },
  { input, output: { file: 'dist/beacon.d.ts', format: 'es' }, plugins: [dts()] },
];
