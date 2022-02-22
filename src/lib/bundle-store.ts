import { promises as fs } from 'fs';
import { posix as path } from 'path';
import { BundleJson } from './bundle-json';
import { ExposeInfo } from './expose-info';
import { PackageInfo } from './package-info';

export class BundleStore {
  private packages: Record<string, PackageInfo> = {};
  private excludePackages = new Set<string>();

  constructor(
    private modulesDirectory: string,
    exposePackages: {
      exclude: string[]
    }) {
      exposePackages.exclude.forEach((name) => this.excludePackages.add(name));
    }

  public getLocalModuleId(moduleId: string): string {
    return moduleId.startsWith(this.modulesDirectory) ? moduleId.substring(this.modulesDirectory.length + 1) : moduleId;
  }

  public async resolveModule(
    moduleId: string
  ): Promise<[PackageInfo, { name: string; localModulePath: string }] | undefined> {
    const moduleSpecifier = this.getLocalModuleId(moduleId);

    const [scopeName, scopedPackageName] = moduleSpecifier.split('/', 2);
    const name = scopeName.startsWith('@') ? `${scopeName}/${scopedPackageName}` : scopeName;
    if (this.excludePackages.has(name)) {
      return undefined;
    }

    let packageInfo: PackageInfo;
    if (this.packages[name]) {
      packageInfo = this.packages[name];
    } else {
      const packageJson = JSON.parse(
        await fs.readFile(path.resolve(this.modulesDirectory, name, 'package.json'), { encoding: 'utf8' })
      );
      const version = packageJson.version;
      const exposes: Record<string, ExposeInfo> = {};
      packageInfo = { version, exposes };
      this.packages[name] = packageInfo;
    }

    const localModulePath = `.${moduleSpecifier.substring(name.length)}`;
    return [packageInfo, { name, localModulePath }];
  }

  getBundleJson(): BundleJson {
    return { packages: this.packages };
  }
}
