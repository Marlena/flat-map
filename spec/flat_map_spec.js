require('./spec_helper');

describe('FlatMap', () => {
  let from, result, subject;
  beforeEach(() => {
    from = require('from');
    subject = require('../src/flat-map');
  });

  function split(data, callback) {
    callback(null, data.split(/\s+/));
  }

  function splitStream(data, callback) {
    callback(null, from(data.split(/\s+/)));
  }

  async function buildStream(array, callback) {
    const pipe = require('multipipe');
    const through = require('through');
    const result = [];
    return new Promise((resolve, reject) => {
      pipe(
        from(array),
        subject(callback),
        through(data => result.push(data), () => resolve(result)),
        err => err && reject(err)
      )
    });
  }

  describe('when the callback is called with an error', () => {
    it.async('emits an error', async() => {
      const error = new Error('some error');
      let err;
      try {
        await buildStream(['one', 'two'], function(data, callback) {
          callback(error, data);
        });
      } catch (e) {
        err = e;
      }
      expect(err).toEqual(error);
    });
  });

  describe('when the callback calls the flush function', () => {
    beforeEach.async(async() => {
      result = await buildStream(['one', 'two'], (data, cb, index, flush) => {
        flush();
      });
    });

    it('kills the stream and does not emit data', () => {
      expect(result).toEqual([]);
    });
  });

  describe('when the callback data is not an array', () => {
    beforeEach.async(async() => {
      result = await buildStream(['one', 'two'], split);
    });

    it('maps a flat stream', () => {
      expect(result).toEqual(['one', 'two']);
    });
  });

  describe('when the callback data returns an array', () => {
    beforeEach.async(async() => {
      result = await buildStream(['one two', 'three', 'four five'], split);
    });

    it('maps a flat stream', () => {
      expect(result).toEqual(['one', 'two', 'three', 'four', 'five']);
    });
  });

  describe('when the callback data returns a stream', () => {
    it.async('maps a flat stream', async() => {
      result = await buildStream(['one two', 'three', 'four five'], splitStream);
      expect(result).toEqual(['one', 'two', 'three', 'four', 'five']);
    });

    describe('when an error is emitted', () => {
      const error = new Error('some-error');

      function splitStreamWithError(data, callback) {
        callback(error);
      }

      it.async('maps a flat stream', async() => {
        let err;
        try {
          await buildStream(['one two', 'three', 'four five'], splitStreamWithError);
        } catch (e) {
          err = e;
        }
        expect(err).toBe(error);
      });
    });
  });

  describe('when the callback data returns a promise', () => {
    describe('when the promise returns a non array', () => {
      function splitPromise(data, callback) {
        callback(null, new Promise(resolve => resolve(data)));
      }

      beforeEach.async(async() => {
        result = await buildStream(['one', 'two', 'three', 'four', 'five'], splitPromise);
      });

      it('maps a flat stream', () => {
        expect(result).toEqual(['one', 'two', 'three', 'four', 'five']);
      });
    });

    describe('when the promise returns an array', () => {
      function splitPromise(data, callback) {
        callback(null, new Promise(resolve => resolve(data.split(/\s+/))));
      }

      beforeEach.async(async() => {
        result = await buildStream(['one two', 'three', 'four five'], splitPromise);
      });

      it('maps a flat stream', () => {
        expect(result).toEqual(['one', 'two', 'three', 'four', 'five']);
      });
    });

    describe('when the promise returns a stream', () => {
      function splitPromise(data, callback) {
        callback(null, new Promise((resolve) => {
          const stream = from(data.split(/\s+/));
          stream.pause();
          streams.push(stream);
          resolve(stream);
        }));
      }

      let streams;

      beforeEach.async(async() => {
        streams = [];
        const promise = buildStream(['one two', 'three', 'four five'], splitPromise);
        await timeout();
        streams.forEach(s => s.resume());
        result = await promise;
      });

      it('maps a flat stream', () => {
        expect(result).toEqual(['one', 'two', 'three', 'four', 'five']);
      });
    });

    describe('when the promise rejects', () => {
      function splitPromise(data, callback) {
        callback(null, new Promise((resolve, reject) => {
          const stream = from(data.split(/\s+/));
          stream.pause();
          streams.push(stream);
          reject(error);
        }));
      }

      let error, streams;

      it.async('emits an error', async() => {
        error = new Error('some error');
        streams = [];
        const promise = buildStream(['one two', 'three', 'four five'], splitPromise);
        await timeout();
        streams.forEach(s => s.resume());
        let err;
        try {
          await promise;
        } catch (e) {
          err = e;
        }
        expect(err).toEqual(error);
      });
    });
  });

  describe('when the callback utilizes the count', () => {
    beforeEach.async(async() => {
      result = await buildStream(['one', 'two', 'three', 'four', 'five'], (data, callback, i) => callback(null, i));
    });

    it('maps the count', () => {
      expect(result).toEqual([0, 1, 2, 3, 4]);
    });
  });
});