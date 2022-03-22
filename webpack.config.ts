import { readFile } from 'fs/promises';
import * as path from 'path';
import { default as ModuleFederationPlugin } from 'webpack/lib/container/ModuleFederationPlugin.js';
// @ts-ignore TS2691 ts-node/esm loader fails when missing extension here
import { modulesDirectory } from './build.config.ts'; 
import { BundleJson } from './src/lib/bundle-json';

const bundleJson: BundleJson = JSON.parse(await readFile('vaadin-bundle.json', { encoding: 'utf8' }));
const exposes = Object.entries(bundleJson.packages)
  .flatMap(([packageName, packageInfo]) =>
    Object.keys(packageInfo.exposes).map((modulePath) => `${packageName}${modulePath.substring(1)}`)
  )
  .reduce<Record<string, string>>((exposes, moduleSpecifier) => {
    exposes[`./node_modules/${moduleSpecifier}`] = `${modulesDirectory}/${moduleSpecifier}`;
    return exposes;
  }, {});

export default {
  mode: 'development',
  entry: {
    vaadin: './src/vaadin.js'
  },
  resolve: {
    symlinks: false,
    conditionNames: [
      'development'
    ]
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  },
  devtool: 'source-map',
  experiments: {
    outputModule: true
  },
  output: {
    path: path.resolve(''),
    filename: '[name].js',
    library: {
      type: 'module'
    }
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'vaadin',
      library: {
        type: 'module'
      },
      exposes
    })
  ]
};
