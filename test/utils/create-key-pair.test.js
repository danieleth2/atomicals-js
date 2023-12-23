'use strict';
var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var index = require('../../dist/index.js');

describe('create-key-pair', () => {
   it('success', async () => {
      const result = await index.createKeyPair();
      expect(result.publicKey.length).to.equal(66);
      expect(result.privateKey.length).to.equal(64);
   });
});
