'use strict';
var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var index = require('../dist/index.js');
 
require('dotenv').config();

describe('e2e', () => {
   it('get latest state', async () => {
      const atomicals = new index.Atomicals(index.ElectrumApi.createClient(process.env.ELECTRUMX_PROXY_BASE_URL || ''));
      const state = await atomicals.getAtomicalState('1', true);
      console.log('state', state);


   });
});