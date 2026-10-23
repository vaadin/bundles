# Vaadin component bundles architecture

This note lives next to the build of the `@vaadin/bundles` package, but it
covers the whole feature: the bundle built here, how the platform release
delivers it to applications, and the Vite plugin in Flow that uses it in the
development server.

Flow 24.x uses the bundle. The plugin was inline in
[`vite.generated.ts`](https://github.com/vaadin/flow/blob/24.10/flow-server/src/main/resources/vite.generated.ts)
as `vaadinBundlesPlugin()`; Flow 25 moved it into an internal package
(vaadin/flow#22301) and then removed it (vaadin/flow#23061). The links to Flow
below point to the `24.10` branch.

## Overview

A Vaadin application depends on about seventy Vaadin web component packages,
and through them on Lit, Highcharts, OpenLayers, marked, DOMPurify and a few
more. `@vaadin/bundles` is all of these built into one file in advance, in a
format that other modules can still import from one by one.

The bundle travels through three stops:

1. **This repository** builds two files. `vaadin.js` is a webpack
   [Module Federation](https://webpack.js.org/concepts/module-federation/)
   container that exposes each module of each bundled package under a key like
   `./node_modules/@vaadin/button/src/vaadin-button.js`.
   `vaadin-bundle.json` is the manifest: which packages are in the bundle, at
   which version, and which names each of their modules exports.
2. **The platform release** publishes the package to npm with the same version
   as the components. The platform's `versions.json` lists it in its `bundles`
   section. Flow reads that list from `vaadin-core-versions.json` and adds
   `@vaadin/bundles` to the application's `package.json`, next to the
   component packages. `VersionsJsonConverter` leaves it out when the
   application excludes the web components.
3. **Flow's Vite plugin**, in the development server, takes over loading the
   bundled modules. When a module imports `@vaadin/button`, Vite still resolves
   it to the file in `node_modules`. The plugin then serves, in its place, a
   small module that gets the same exports from the container.

## Design goals

- **No pre-bundling of the Vaadin dependencies.** Vite's development server
  serves application code as ES modules, but first pre-bundles the
  dependencies from `node_modules` with esbuild (`optimizeDeps`). For a
  Vaadin application, that means thousands of modules: the components and
  everything they use. Pre-bundling them made the dev server slow to start,
  and it ran again, with a full page reload, whenever Vite found a dependency
  it had not seen yet. The bundle does this work once, at release time, and
  applications only download the result.
- **Keep what bundling gives the browser.** The browser loads the
  dependencies as one large file that it can cache. It does not load them as
  a waterfall of thousands of module requests, each one found only after the
  module that imports it has loaded. The application becomes interactive
  sooner.
- **Open to the application's own modules.** A bundle is usually a closed
  world. A federated container is not: any module can import any exposed
  module from it, at any time. Application code, add-ons and generated files
  stay plain Vite modules that import `@vaadin/button` or `lit` with their
  normal specifiers. They are not rebundled, and adding one does not rebuild
  the bundle. This matters most in Hilla applications, where the client-side
  views are application modules built on the bundled components and
  libraries.
- **Transparent, with a safe fallback.** Applications do not change their
  imports, their configuration or their dependencies. When the bundle is not
  installed, or does not match the installed packages, the plugin turns itself
  off, and Vite pre-bundles the dependencies as it would without it.

## Scope and what is not covered

- **Development server only.** A production build does not use the bundle.
  Rollup bundles and tree-shakes the application with the source packages, as
  usual. A production build could also use a federated bundle in a similar
  way, but that was never implemented.
- **The npm packages are still installed.** The bundle does not replace
  installing the component packages. The plugin compares versions with the
  installed packages, and it shims a module only after Vite has resolved it to
  a file in `node_modules`. TypeScript also needs those installed packages for
  their type definitions, since the bundle has no `.d.ts` files. Using the
  bundle without installing the packages, types included, is a missing
  feature.
- **The version check is per bundle, not per module.** One mismatching package
  turns off the whole bundle (see
  [Deciding whether to use the bundle](#deciding-whether-to-use-the-bundle)).
  A finer check, which would serve only the mismatching packages, or the
  modules that depend on them, from `node_modules` and keep using the bundle
  for the rest, is not implemented.

## The bundle format

### The container

`vaadin.js` is an ES module with the two functions of a Module Federation
container:

- `init(shareScope)` initializes the container's shared dependencies. The
  bundle declares none, so the call has nothing to do; it is still made,
  because the container protocol expects it.
- `get(key)` returns a promise of a factory. Calling the factory returns the
  module's exports object. An unknown key rejects with
  `Module … does not exist in container`.

The keys are the module specifiers prefixed with `./node_modules/`, for
example `./node_modules/@vaadin/button`,
`./node_modules/@vaadin/button/vaadin-button.js` and
`./node_modules/@vaadin/button/src/vaadin-button.js`. Each module runs once
per container, the first time it, or a module that imports it, is requested.
Inside the container, modules import each other through webpack's own module
registry, so the bundle never asks the browser for anything else.

### The manifest

`vaadin-bundle.json` has the shape of `BundleJson`
([`src/lib/bundle-json.ts`](src/lib/bundle-json.ts) and the types next to
it):

```json
{
  "packages": {
    "@vaadin/button": {
      "version": "25.4.0-alpha2",
      "exposes": {
        ".": { "exports": [{ "source": "@vaadin/button/vaadin-button.js" }] },
        "./vaadin-button.js": { "exports": [{ "source": "@vaadin/button/src/vaadin-button.js" }] },
        "./src/vaadin-button.js": { "exports": ["Button"] }
      }
    }
  }
}
```

The keys of `exposes` are module paths in the package; `.` is the package
entry. Each export is one of:

- a name, such as `"Button"`, or `"default"` for a default export;
- `{ source }` for `export * from '…'`: the module re-exports all the names of
  `source`, which is another module in the manifest;
- `{ namespace, source }` for `export * as namespace from '…'`.

The manifest lists the names, not the values, because a module that stands in
for a bundled module has to declare its exports when it is written, before
any of the bundle runs (see [Using the bundle](#using-the-bundle-in-flows-vite-dev-server)).

Flow tests the feature with a hand-written imitation of the bundle,
[`vite-test-assets/packages/@vaadin/bundles`](https://github.com/vaadin/flow/blob/24.10/flow-tests/test-frontend/vite-test-assets/packages/%40vaadin/bundles/vaadin.js).
It is a small example of each case: `@vaadin/testscope-button` is a package
entry that re-exports `./src/testscope-button.js`, `@vaadin/testscope-map`
uses a default export, and `@vaadin/testscope-all` only imports the other two
for their side effects and exports nothing.

## Building the bundle

`npm run build` runs two builds in a row: a Rollup build that only collects
information, and the webpack build that makes the container.

### What goes in

[`build.config.ts`](build.config.ts) holds the lists:

- `vaadinWebComponentPackages`: the Vaadin packages whose version follows the
  version of the bundle;
- `dependencyPackages`: other packages whose peer dependency version is pinned
  (Highcharts);
- `autoUpdatePackages`: the Lit internals, updated to the latest matching
  version with each release;
- `exposePackages.exclude`: packages that may be bundled but are never
  exposed (the Lit internals, see [Lit](#lit)).

The entry point is [`src/vaadin.js`](src/vaadin.js). Its `main` function
imports [`src/all-imports.js`](src/all-imports.js), which imports every
package and every extra entry point that should be in the bundle, such as
`@vaadin/grid/lit.js` or `lit/directives/repeat.js`. The import is an eager
dynamic `import()` wrapped in a function, so the modules end up in the main
chunk but none of them runs until it is requested. A package that is in the
bundle only as a dependency, and should not be imported on its own, gets an
`// ignore <reason> import '…';` line instead, so the test can see it was left
out on purpose.

### Collecting the manifest

`npm run build:scan` runs Rollup with `bundleInfoRollupPlugin`
([`src/lib/bundle-info-rollup-plugin.ts`](src/lib/bundle-info-rollup-plugin.ts)).
Rollup walks the whole import graph from the entry point. The plugin records
each module it meets under `node_modules` in a `BundleStore`
([`src/lib/bundle-store.ts`](src/lib/bundle-store.ts)), which groups the
modules by package and reads each package's version from its `package.json`.

- `transform` parses the module and reads its top-level `export`
  declarations into the export list. It also sets
  `moduleSideEffects: 'no-treeshake'`, so Rollup keeps every module, used or
  not.
- `resolveId` finds the package entry, `.`. When a package is first met
  through a deep import, the plugin resolves the bare package name once more,
  to record which module the entry points to.
- `renderChunk` returns an empty string: the scan does not produce any
  JavaScript.
- `generateBundle` writes `vaadin-bundle.json`. It also rewrites
  `peerDependencies` in `package.json`: each bundled package becomes an
  optional peer dependency at its bundled version, except the
  `autoUpdatePackages`. Since they are optional, npm installs only the ones
  the application needs anyway, but it holds those to the bundled version.

### Building the container

`npm run build:bundle` runs webpack with
[`webpack.config.ts`](webpack.config.ts). It reads `vaadin-bundle.json` and
exposes each module of it with `ModuleFederationPlugin`, as
`./node_modules/<package><path>`. The container is named `vaadin` and is
written as an ES module library to `vaadin.js`.

The build is a development build: `mode: 'development'`, the `development`
export condition, and `vaadin.js.map`. The bundle only runs in a development
server, where readable code, source maps and the development builds of
libraries (such as Lit's warnings) are what a developer wants. The tests
expect `vaadin.js` and its map to be between 4 and 16 MB each.

### Lit

Lit is in the bundle: the `lit` package, with all its entry points, is
exposed. Its internals, `lit-html`, `lit-element`, `@lit/reactive-element`
and `@lit-labs/ssr-dom-shim`, are bundled but not exposed under their own
names. With pinned peer dependencies on them, npm failed to install
applications whose add-ons needed another Lit version
(vaadin/flow-components#2950). Now an application or add-on can import
another version of these packages, which Vite serves the usual way, while the
bundled components keep using their own.

Two things keep them out:

- `exposePackages.exclude` tells `BundleStore` to skip them, so they are not
  in the manifest, and not in `peerDependencies`.
- The `devDependencies` point the four package names to the empty stub
  packages in [`src/fake-modules/`](src/fake-modules). The stub takes the
  top-level `node_modules/lit-html` (and the others), so npm installs the
  real ones under `node_modules/lit/node_modules/`. The bundle's copies are
  then modules of the `lit` package in the manifest, not packages of their
  own.

## Releasing

`npm version <version>` runs [`scripts/version.ts`](scripts/version.ts). It
sets the new version for all the `vaadinWebComponentPackages` in
`devDependencies` and `peerDependencies`, sets the `dependencyPackages` peer
versions, runs `npm update` for the `autoUpdatePackages`, and regenerates the
`lit/*` import lines in `src/all-imports.js` from the `exports` of the
installed `lit`.

`npm publish` builds the package (`prepare`), and `postpack` runs the tests.
The published package contains `vaadin.js`, its source map and
`vaadin-bundle.json`; `.npmignore` leaves out the sources and the build
configuration.

The tests are in [`src/test/`](src/test):

- `bundle-json.test.ts` checks the manifest: the Vaadin packages are there at
  the bundle version with the expected exposes, the external dependencies
  are there, `@vaadin/bundles` itself and the Lit internals are not, every
  package in the manifest is imported or ignored in `src/all-imports.js`, and
  every package is an optional peer dependency.
- `bundle.test.ts` checks the container: the sizes, `get` for each kind of
  key, and the errors for the keys that must not exist.

## Using the bundle in Flow's Vite dev server

`vaadinBundlesPlugin()` is in the `plugins` of the generated Vite
configuration as `devMode && vaadinBundlesPlugin()`. It only applies to
`serve`, so it is used when Flow runs a Vite development server, and not for
the pre-compiled development bundle or a production build. Here is what it
does, in order.

### Deciding whether to use the bundle

`apply` reads `@vaadin/bundles/vaadin-bundle.json` from `node_modules`. The
plugin turns itself off for the rest of the server run when:

- the package is not installed (it logs that the bundles are disabled);
- any bundled package is installed at a different version than the one in
  the manifest (vaadin/flow#12942). It logs the mismatches.

The version check prevents surprises: the application always runs the
versions it asked for in its `package.json`, never other versions that
happen to be in the bundle. That way an application can override a
dependency, for example to try a patched component, and get what it
installed. A package that is not installed at all is not a mismatch.

The check covers the whole bundle, so one mismatch turns off all of it,
including the packages that match. A finer check per package or per module
is not implemented.

### Excluding the bundled packages from pre-bundling

`config` adds `@vaadin/bundles` and each package from the manifest to
`optimizeDeps.exclude`. Vite then serves these packages as source modules
instead of pre-bundling them. A dependency that Vite still pre-bundles, such
as `@vaadin/react-components`, keeps its imports of the excluded packages as
imports, so they also go through the plugin.

### Serving a bundled module from the container

`load` runs before Vite's own loading (`enforce: 'pre'`). For each module id
under `node_modules`, `getExports` looks it up in the manifest by package name
and module path. It returns the module's export names, adding the names of
every `{ source }` re-export, recursively. When the module is in the
manifest, `load` returns a stand-in for it instead of reading the file. For
`@vaadin/button/src/vaadin-button.js`:

```js
import { init as VaadinBundleInit, get as VaadinBundleGet } from '@vaadin/bundles/vaadin.js?v=…';
await VaadinBundleInit('default');
const { Button } = (await VaadinBundleGet('./node_modules/@vaadin/button/src/vaadin-button.js'))();
export { Button };
```

- The query of the requested module is added to the bundle import. Vite
  adds `?v=<browserHash>` to the `node_modules` modules it does not
  pre-bundle. All the stand-ins import the same URL, so the browser
  loads the container once, and caches it until Vite changes the version.
- Top-level `await` makes each stand-in wait until the container has run the
  module, so the importing modules see its exports and side effects, as they
  would with the real file.
- A default export is read as `default: _default` and exported as
  `_default as default`, since `default` can not be a variable name
  (vaadin/flow#14355).

### How the application's modules join in

Every import of a bundled module, from anywhere, becomes a stand-in for the
same container, and the container runs each module once. So an application
module, a Flow-generated import file, an add-on or a Hilla view all get the
same `Button` class and the same Lit, and each custom element is defined
once. A module that is not in the bundle, such as an add-on component, is
served by Vite as usual and can import bundled modules like any other module.
That is the federation: the bundle is extended module by module, without
building anything again.

## Decisions and gotchas

- **The installed version wins.** When the installed versions don't match the
  bundle, the application gets what it installed, at the cost of the
  pre-bundling time the bundle would have saved. Right now this is all or
  nothing for the whole bundle.
- **No shared dependencies.** The container declares no `shared` modules, so
  `init` does not negotiate versions with the application. When the
  application also imports another version of a bundled package that Vite
  serves on its own, the browser has two copies. That is the intent for the
  Lit internals; for the other packages, the version check prevents it.
- **The export names are static.** The stand-in can only re-export the names
  the scan found. An export that the AST walk misses is not available through
  the bundle.
- **The bundle runs whole modules.** The bundle is not tree-shaken, and
  importing a module from it runs everything that module imports. Only a
  production build removes unused code.
- **`peerDependencies` is generated.** The build rewrites it. To change
  a version, change `build.config.ts` or the `devDependencies` and build.
- **Every package must be imported or ignored.** A new dependency of a
  component shows up in the manifest. The test then fails until
  `src/all-imports.js` imports it or has an `// ignore` line for it.

## Working on it

- `npm ci` installs and builds; `npm run build` rebuilds; `npm test` runs the
  tests on the built files.
- To try a local build in an application, install the package from the
  folder or from `npm pack`. Install the same component versions, or the
  plugin turns the bundle off.
- Flow's integration tests on `24.10` use the imitation bundle:
  `flow-tests/test-frontend/vite-basics` (`BundlesIT`: the components come
  from the bundle, named and default exports work, and the packages are
  excluded from pre-bundling) and `flow-tests/test-frontend/vite-context-path`
  (`BundlesIT`: it installs the `bundles-old` imitation, whose versions do not
  match, and checks that the bundle is not used).
