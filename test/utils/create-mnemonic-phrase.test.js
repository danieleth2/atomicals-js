'use strict';
var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var index = require('../../dist/index.js');

describe('create-mnemonic-phrase', () => {
   it('success', async () => {
      const result = index.createMnemonicPhrase();
      expect(result.phrase).to.not.be.null
   });
});