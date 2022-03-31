import { createFilter, FilterPattern } from '@rollup/pluginutils';
import type { Program } from 'estree';
import type { FunctionDeclaration, Identifier, Property, VariableDeclarator } from 'estree';
import { walk } from 'estree-walker';
import * as fs from 'fs/promises';
import { posix as path } from 'path';
import { Plugin } from 'rollup';
import { BundleStore } from './bundle-store';

export const bundleInfoRollupPlugin = (
  options: {
    modulesDirectory?: string,
    exposePackages?: {
      exclude?: string[]
    },
    include?: FilterPattern,
    exclude?: FilterPattern
  } = {}
): Plugin => {
  const modulesDirectory = path.resolve(process.cwd(), options.modulesDirectory || './node_modules');
  const exposePackages = {
    exclude: options.exposePackages && options.exposePackages.exclude || []
  };
  const bundleStore = new BundleStore(modulesDirectory, exposePackages);
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'bundleInfoRollupPlugin',
    async resolveId(source, importer, options) {
      if (options.isEntry) {
        return null;
      }

      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options
      });

      const id = source.startsWith('.') ? resolution.id : source;
      if (!resolution.id.startsWith(modulesDirectory)) {
        return null;
      }

      const bundleStoreData = await bundleStore.resolveModule(id);
      if (!bundleStoreData) {
        return null;
      }

      const [packageInfo, {name}] = bundleStoreData;
      if (!packageInfo.exposes['.']) {
        if (!options.custom?.bundleInfoRollupPlugin?.isPackageEntry) {
          try {
            await this.resolve(name, importer, {
              ...options,
              custom: {
                bundleInfoRollupPlugin: {
                  isPackageEntry: true
                }
              }
            });
          } catch (_) {
            // Package entry is not resolvable, ignore
          }
        } else {
          packageInfo.exposes['.'] = {
            exports: [
              {
                source: bundleStore.getLocalModuleId(resolution.id)
              }
            ]
          };
        }
      }

      return resolution;
    },

    async transform(code, sourceId) {
      if (!filter(sourceId)) {
        return;
      }
      if (!sourceId.startsWith(modulesDirectory)) {
        return;
      }

      const id = bundleStore.getLocalModuleId(sourceId);
      const bundleStoreData = await bundleStore.resolveModule(id);
      if (!bundleStoreData) {
        return;
      }

      const [packageInfo, { localModulePath }] = bundleStoreData;
      if (!packageInfo.exposes[localModulePath]) {
        packageInfo.exposes[localModulePath] = { exports: [] };
      }
      const exports = packageInfo.exposes[localModulePath].exports;

      const ast = this.parse(code);

      const getTargetId = async (value: string) => {
        const targetResolution = await this.resolve(value, sourceId);
        const targetSourceId = targetResolution.id;
        return bundleStore.getLocalModuleId(targetSourceId);
      };

      for (const topLevelNode of (ast as unknown as Program).body) {
        if (topLevelNode.type === 'ExportAllDeclaration') {
          const namespace = topLevelNode.exported ? topLevelNode.exported.name : undefined;
          const source = await getTargetId(topLevelNode.source.value as string);
          exports.push({ namespace, source });
        } else if (topLevelNode.type === 'ExportDefaultDeclaration') {
          exports.push('default');
        } else if (topLevelNode.type === 'ExportNamedDeclaration') {
          if (topLevelNode.declaration) {
            walk(topLevelNode.declaration, {
              enter(node, parent) {
                if (
                  node.type === 'BlockStatement' ||
                  node.type === 'ClassBody' ||
                  (parent && parent.type === 'VariableDeclarator' && (parent as VariableDeclarator).init === node) ||
                  (parent && parent.type === 'Property' && (parent as Property).value === node) ||
                  (parent && parent.type === 'FunctionDeclaration' && (parent as FunctionDeclaration).id !== node)
                ) {
                  this.skip();
                } else if (node.type === 'Identifier') {
                  this.skip();
                  exports.push((node as Identifier).name);
                }
              }
            });
          } else {
            for (const specifier of topLevelNode.specifiers) {
              exports.push(specifier.exported.name);
            }
          }
        }
      }

      return {
        moduleSideEffects: 'no-treeshake'
      };
    },

    renderChunk() {
      return '';
    },

    async generateBundle() {
      const bundleJson = bundleStore.getBundleJson();
      this.emitFile({
        type: 'asset',
        fileName: 'vaadin-bundle.json',
        source: JSON.stringify(bundleJson, undefined, 2)
      });

      // update peer dependencies in package.json
      const peerDependencies: Record<string, string> = {};
      const peerDependenciesMeta: Record<string, {optional?: true}> = {};
      const packageNames = Object.keys(bundleJson.packages);
      packageNames.sort();
      for (const packageName of packageNames) {
        peerDependencies[packageName] = bundleJson.packages[packageName].version;
        peerDependenciesMeta[packageName] = {optional: true};
      }
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, {encoding: 'utf8'}));
      packageJson.peerDependencies = peerDependencies;
      packageJson.peerDependenciesMeta = peerDependenciesMeta;
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, undefined, 2), {encoding: 'utf8'});
    }
  };
};
