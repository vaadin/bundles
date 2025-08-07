import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { describe, it } from 'mocha';
import { autoUpdatePackages } from '../../build.config.js';
import { BundleJson } from '../lib/bundle-json.js';
import { PackageInfo } from '../lib/package-info.js';

describe('vaadin-bundle.json', () => {
  let bundleJson: BundleJson;
  let packageJson;
  let bundleVersion;

  before(async () => {
    bundleJson = JSON.parse(await readFile('vaadin-bundle.json', { encoding: 'utf8' }));
    packageJson = JSON.parse(await readFile('package.json', { encoding: 'utf8' }));
    bundleVersion = packageJson.version;
  });

  class PackageNotFoundError extends Error {
    constructor(packageName: string) {
      super(`Package not found: ${packageName}`);
    }
  }

  function getPackage(name: string): PackageInfo {
    if (!bundleJson.packages[name]) {
      throw new PackageNotFoundError(name);
    }

    return bundleJson.packages[name];
  }

  it('should contain Vaadin components', () => {
    const button = getPackage('@vaadin/button');
    expect(button.version).to.equal(bundleVersion);
    expect(button.exposes).to.deep.include({
      '.': {
        exports: [
          {
            source: '@vaadin/button/vaadin-button.js'
          }
        ]
      },
      './vaadin-button.js': {
        exports: [
          {
            source: '@vaadin/button/src/vaadin-button.js'
          }
        ]
      },
      './src/vaadin-button-mixin.js': {
        exports: ['ButtonMixin']
      },
      './src/vaadin-button.js': {
        exports: ['Button']
      },
    });

    expect(getPackage('@vaadin/grid').version).to.equal(bundleVersion);
    expect(getPackage('@vaadin/charts').version).to.equal(bundleVersion);
  });

  it('should contain Vaadin dependencies', () => {
    getPackage('highcharts');

    const lit = getPackage('lit');
    expect(lit.version).to.match(/^3\./);
  });

  it('shoud not contain itself', () => {
    expect(() => getPackage('@vaadin/bundles')).to.throw(PackageNotFoundError);
  });

  it('shoud not contain lit libraries', () => {
    expect(() => getPackage('lit-html')).to.throw(PackageNotFoundError);
    expect(() => getPackage('lit-element')).to.throw(PackageNotFoundError);
    expect(() => getPackage('@lit/reactive-element')).to.throw(PackageNotFoundError);
    expect(() => getPackage('@lit-labs/ssr-dom-shim')).to.throw(PackageNotFoundError);
  });

  it('should list all packages in all-imports', async () => {
    const packageNames = Object.keys(bundleJson.packages);
    const allImportsSource = await readFile('src/all-imports.js', { encoding: 'utf8' });
    const allImports = allImportsSource
      .split(/(\r|\n|\r\n)/)
      .map((line) => line.replace(/^\/\/ ignore .* import/, 'import'))
      .filter((line) => line.startsWith('import '))
      .map((importLine) => /^import '([^']*)';$/.exec(importLine)[1]) as string[];
    const missingPackageNames = new Set(packageNames.sort());
    allImports.forEach((source) => {
      // Get the actual npm package name
      const name = source.split('/').slice(0,2).join('/');
      missingPackageNames.delete(name);
    });
    if (missingPackageNames.size > 0) {
      expect.fail(`Detected missing package(s) in src/all-imports.js:

${Array.from(missingPackageNames).join('\n')}

Please add import or ignore line(s) for these.`);
    }
  });

  it('should list all packages in as optional peer dependencies',async () => {
    expect(packageJson).to.have.property('peerDependencies').that.is.an('object');
    const peerDependencies = packageJson.peerDependencies as Record<string, string>;
    expect(packageJson).to.have.property('peerDependenciesMeta').that.is.an('object');
    const peerDependenciesMeta = packageJson.peerDependenciesMeta as Record<string, {optional?: boolean}>;
    for (const [packageName, packageInfo] of Object.entries(bundleJson.packages)) {
      if (autoUpdatePackages.includes(packageName)) {
        continue;
      }
      expect(peerDependencies).to.have.property(packageName, packageInfo.version);
      expect(peerDependenciesMeta).to.have.deep.property(packageName, {optional: true});
    }
  });
});
