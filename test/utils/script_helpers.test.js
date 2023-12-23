'use strict';
var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var index = require('../../dist/index.js');

describe('script_helpers test', () => {
   it('success decode p2tr', async () => {
      const result = index.detectScriptToAddressType('512009034ea14147937a1fa23c8afe754170ce9ea34571aadd27e29e982d94f06b12');
      expect(result).to.eql("bc1ppyp5ag2pg7fh58az8j90ua2pwr8fag69wx4d6flzn6vzm98sdvfqg0ts4r")
   });
   it('success decode witness_v0_keyhash', async () => {
      const result = index.detectScriptToAddressType('0014e2cd6ed2fe3567379170d6d9ebd54c63a629f41c');
      expect(result).to.eql("bc1qutxka5h7x4nn0yts6mv7h42vvwnznaquky6v33")
   });
   it('success decode p2pkh', async () => {
      const result = index.detectScriptToAddressType('76a91459efb00b08d01fb31defbaa77a02be63b1c7eab788ac');
      expect(result).to.eql("19CYGs7iizwJqk8z6UemofDZztYB9YVuW9")
   });
});
