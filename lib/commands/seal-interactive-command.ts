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

import { IWalletRecord } from "../utils/validate-wallet-storage";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

export class SealInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private atomicalId: string,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
  ) {
  }

  async run(): Promise<any> {
    logBanner(`Seal Interactive`);
    const { atomicalInfo, locationInfo, inputUtxoPartial } = await getAndCheckAtomicalInfo(this.electrumApi, this.atomicalId, this.owner.address);
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.owner.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'sl',
      nftOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Add the atomical to update
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)

    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }

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