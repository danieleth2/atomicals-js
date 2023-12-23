

import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { getAndCheckAtomicalInfo, logBanner } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

export class DisableSubrealmRulesInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private atomicalId: string,
    private funding: IWalletRecord,
    private owner: IWalletRecord,
  ) {
  }
  async run(): Promise<any> {
    logBanner(`Disable Subrealm Minting Rules Interactive`);
    
    const { atomicalInfo, locationInfo, inputUtxoPartial } = await getAndCheckAtomicalInfo(this.electrumApi, this.atomicalId, this.owner.address, 'NFT', null);

    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.owner.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'mod',
      nftOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });
 
    await atomicalBuilder.setData({
      subrealms: true,
      $a: 1
    });
    // Just add some bitwork to make it use the funding address
    atomicalBuilder.setBitworkCommit('1');

    // Add the atomical to update
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)
  // The receiver output
    atomicalBuilder.addOutput({
      address: this.owner.address,
      value: this.options.satsoutput as any || 1000
    });
    


    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }
}


