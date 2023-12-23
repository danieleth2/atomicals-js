'use strict';
var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var index = require('../../dist/index.js');

describe('wallet-create', () => {
   it('success', async () => {
      const result = await index.Atomicals.walletCreate();
      expect(result.success).to.be.true;
      expect(result.data.wallet.phrase).to.not.equal(undefined)
      expect(result.data.wallet.primary.WIF).to.not.equal(undefined)
      expect(result.data.wallet.primary.address).to.not.equal(undefined)
      expect(result.data.wallet.primary.privateKey).to.not.equal(undefined)
      expect(result.data.wallet.primary.publicKey).to.not.equal(undefined)
      expect(result.data.wallet.primary.publicKeyXOnly).to.not.equal(undefined)
      expect(result.data.wallet.primary.path).to.not.equal(undefined)
      expect(result.data.wallet.funding.WIF).to.not.equal(undefined)
      expect(result.data.wallet.funding.address).to.not.equal(undefined)
      expect(result.data.wallet.funding.privateKey).to.not.equal(undefined)
      expect(result.data.wallet.funding.publicKey).to.not.equal(undefined)
      expect(result.data.wallet.funding.publicKeyXOnly).to.not.equal(undefined)
      expect(result.data.wallet.funding.path).to.not.equal(undefined)
 
   });
});
 