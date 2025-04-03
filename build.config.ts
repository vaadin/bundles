/**
 * Configuration for the bundles build
 */

/**
 * Modules directory for the bundles build. If building in a workspace,
 * set to workspace root.
 */
export const modulesDirectory = './node_modules';

export const exposePackages = {
  /**
   * The listed packages are not exposed in the bundle, although they may
   * be bundled as dependencies.
   */
  exclude: [
    // NOTE: Lit libraries are excluded to allow installing and using different
    // versions (possibly older versions installed by addons) simultaniously.
    // See: https://github.com/vaadin/flow-components/issues/2950
    'lit-html',
    'lit-element',
    '@lit/reactive-element',
    '@lit-labs/ssr-dom-shim',
  ],
};

/**
 * The versions of listed packages are automatically updated in the
 * `package.json` file in sync with the version of the bundles package.
 * See the `npm version` script.
 */
export const vaadinWebComponentPackages = [
  '@vaadin/a11y-base',
  '@vaadin/accordion',
  '@vaadin/app-layout',
  '@vaadin/avatar-group',
  '@vaadin/avatar',
  '@vaadin/board',
  '@vaadin/button',
  '@vaadin/card',
  '@vaadin/charts',
  '@vaadin/checkbox-group',
  '@vaadin/checkbox',
  '@vaadin/combo-box',
  '@vaadin/component-base',
  '@vaadin/confirm-dialog',
  '@vaadin/context-menu',
  '@vaadin/cookie-consent',
  '@vaadin/crud',
  '@vaadin/custom-field',
  '@vaadin/dashboard',
  '@vaadin/date-picker',
  '@vaadin/date-time-picker',
  '@vaadin/details',
  '@vaadin/dialog',
  '@vaadin/email-field',
  '@vaadin/field-base',
  '@vaadin/field-highlighter',
  '@vaadin/form-layout',
  '@vaadin/grid-pro',
  '@vaadin/grid',
  '@vaadin/horizontal-layout',
  '@vaadin/icon',
  '@vaadin/icons',
  '@vaadin/input-container',
  '@vaadin/integer-field',
  '@vaadin/item',
  '@vaadin/list-box',
  '@vaadin/lit-renderer',
  '@vaadin/login',
  '@vaadin/map',
  '@vaadin/master-detail-layout',
  '@vaadin/menu-bar',
  '@vaadin/message-input',
  '@vaadin/message-list',
  '@vaadin/multi-select-combo-box',
  '@vaadin/notification',
  '@vaadin/number-field',
  '@vaadin/overlay',
  '@vaadin/password-field',
  '@vaadin/polymer-legacy-adapter',
  '@vaadin/popover',
  '@vaadin/progress-bar',
  '@vaadin/radio-group',
  '@vaadin/rich-text-editor',
  '@vaadin/scroller',
  '@vaadin/select',
  '@vaadin/side-nav',
  '@vaadin/split-layout',
  '@vaadin/tabs',
  '@vaadin/tabsheet',
  '@vaadin/text-area',
  '@vaadin/text-field',
  '@vaadin/time-picker',
  '@vaadin/tooltip',
  '@vaadin/upload',
  '@vaadin/vaadin-lumo-styles',
  '@vaadin/vaadin-themable-mixin',
  '@vaadin/virtual-list',
  '@vaadin/vertical-layout',
];

/**
 * The listed packages are automatically updated to the newest matching
 * version for every new version of bundles. See the `npm version` script.
 */
export const autoUpdatePackages = [
  'lit-html',
  'lit-element',
  '@lit/reactive-element',
  '@lit-labs/ssr-dom-shim',
];
