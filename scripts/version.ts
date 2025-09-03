import * as path from 'path';
import * as os from 'os';
import * as fsPromises from 'fs/promises';
import { env } from 'process';
import { promisify } from 'util';
import * as child_process from 'child_process';
import.meta.resolve
import { autoUpdatePackages, dependencyPackages, modulesDirectory, vaadinWebComponentPackages } from '../build.config.js';
import { Module } from 'module';

async function exec(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`$ ${cmd}`);
    const process = child_process.spawn(cmd, { shell: true, stdio: 'inherit' });
    process.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Child process exited with non-zero status ${code}`));
      }
    });
  })
}

// --- Update Vaadin web component versions

console.log('Updating Vaadin web components versions in "package.json"...')
const packageJson = JSON.parse(await fsPromises.readFile('package.json', { encoding: 'utf-8' }));
const version = packageJson.version;
for (const p of vaadinWebComponentPackages) {
  packageJson.devDependencies[p] = version;
  packageJson.peerDependencies[p] = version;
}
Object.entries(dependencyPackages).forEach(([p,v]) => {
  packageJson.devDependencies[p] = v;
  packageJson.peerDependencies[p] = v;
});
await fsPromises.writeFile(
  'package.json',
  JSON.stringify(packageJson, undefined, 2),
  { encoding: 'utf-8' }
);

// --- Update selected bundled dependencies

for (const p of autoUpdatePackages) {
  console.log(`Updating package ${p}...`);
  await exec(`npm update ${p}`);
}

// --- Update imports in "src/all-imports.js"...

console.log('Updating lit imports in "src/all-imports.js"...');

const allImportsFile = path.join('src', 'all-imports.js');
const litPackageJson = JSON.parse(await fsPromises.readFile(
  path.resolve(modulesDirectory, 'lit', 'package.json'),
  { encoding: 'utf-8' }
));
const litExports = Object.keys(litPackageJson.exports);
const litImportLines = litExports.map(p => `import 'lit${p.substring(1)}';`);
const allImportLines = (
  await fsPromises.readFile(
    allImportsFile,
    { encoding: 'utf-8' }
  )
).split("\n")
.filter(line => !line.startsWith('import \'lit'))
.concat(litImportLines);
await fsPromises.writeFile(
  allImportsFile,
  allImportLines.join("\n"),
  { encoding: 'utf-8' }
);
await exec(`git update-index ${allImportsFile}`);
