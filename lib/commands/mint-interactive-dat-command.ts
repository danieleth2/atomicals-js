import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { prepareFilesDataAsObject, readFileAsCompleteDataObject } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
export class MintInteractiveDatCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private filepath: string,
    private givenFileName: string,
    private address: string,
    private fundingWIF: string,
  ) {
    this.options = checkBaseRequestOptions(this.options)
  }
  async run(): Promise<any> {
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'dat',
      datOptions: {
        satsoutput: 1000
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });
    // Attach any default data
    let filesData = await readFileAsCompleteDataObject(this.filepath, this.givenFileName);
    console.log('filesData', filesData);
    await atomicalBuilder.setData(filesData);
    // Attach any requested bitwork
    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }
    if (this.options.bitworkr) {
      atomicalBuilder.setBitworkReveal(this.options.bitworkr);
    }

    if (this.options.parent) {
      atomicalBuilder.setInputParent(await AtomicalOperationBuilder.resolveInputParent(this.electrumApi, this.options.parent, this.options.parentOwner as any))
    }
    
    // The receiver output of store data
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput || 1000
    });
    
    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }
}