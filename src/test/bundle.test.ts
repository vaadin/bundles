import { expect } from 'chai';
import { stat } from 'fs/promises';
import { describe, it } from 'mocha';

describe('vaadin.js', () => {
  describe('size', () => {
    const Mbyte = 1024 * 1024;

    it('should have a js size within a range', async () => {
      const size = (await stat('vaadin.js')).size;
      expect(size).to.be.above(4 * Mbyte);
      expect(size).to.be.below(16 * Mbyte);
    });

    it('should have a map size within a range', async () => {
      const size = (await stat('vaadin.js.map')).size;
      expect(size).to.be.above(4 * Mbyte);
      expect(size).to.be.below(16 * Mbyte);
    });
  });

  describe('exposes', () => {
    let init: (string) => void;
    let get: (string) => Promise<() => any>;

    before(async () => {
      // ensure global self
      (global as any).self = {};
      const bundle = await import(new URL('../../vaadin.js', import.meta.url).toString());
      init = bundle.init;
      get = bundle.get;
      init('default');
    });

    it('should contain Vaadin component modules', async () => {
      expect(await get('./node_modules/@vaadin/button')).to.be.instanceOf(Function);
      expect(await get('./node_modules/@vaadin/button/vaadin-button.js')).to.be.instanceOf(Function);
      expect(await get('./node_modules/@vaadin/button/src/vaadin-button.js')).to.be.instanceOf(Function);

      expect(await get('./node_modules/@vaadin/grid')).to.be.instanceOf(Function);
      expect(await get('./node_modules/@vaadin/charts')).to.be.instanceOf(Function);
    });

    it('should contain Vaadin component dependencies', async () => {
      expect(await get('./node_modules/highcharts/es-modules/Core/Chart/Chart.js')).to.be.instanceOf(Function);
      expect(await get('./node_modules/highcharts/es-modules/masters/highstock.src.js')).to.be.instanceOf(Object);
    });

    it('shoud not contain itself', async () => {
      let error;
      try {
        await get('./node_modules/@vaadin/bundle');
      } catch (e: unknown) {
        error = e;
      } finally {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.contain('does not exist in container');
      }
    });

    it('shoud not contain lit libraries', async () => {
      let promises = await Promise.allSettled([
        'lit-html',
        'lit-element',
        '@lit/reactive-element'
      ].map(specifier => get(`./node_modules/${specifier}`)));
      expect(promises).to.have.lengthOf(3);
      for (const promise of promises) {
        expect(promise.status).to.equal('rejected');
        const error = (promise as PromiseRejectedResult).reason;
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.contain('does not exist in container');
      }
    });
  });
});
