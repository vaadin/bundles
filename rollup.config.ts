import { nodeResolve } from '@rollup/plugin-node-resolve';
import * as path from 'path';
import { RollupOptions } from 'rollup';
import { modulesDirectory, exposePackages } from './build.config';
import { bundleInfoRollupPlugin } from './src/lib/bundle-info-rollup-plugin';

const rollupOptions: RollupOptions = {
  input: 'src/vaadin.js',
  preserveSymlinks: true,
  plugins: [
    bundleInfoRollupPlugin({
      modulesDirectory,
      exposePackages
    }),
    nodeResolve({
      exportConditions: ['development']
    })
  ],
  output: {
    format: 'esm',
    dir: path.resolve('./'),
    sourcemap: false,
    inlineDynamicImports: true
  }
};

export default rollupOptions;
