import { ElectrumApiInterface } from "../api/electrum-api.interface";

import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { hydrateConfig } from "../utils/hydrate-config";
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { GetByRealmCommand } from "./get-by-realm-command";
import { checkBaseRequestOptions, isValidBitworkMinimum, isValidBitworkString } from "../utils/atomical-format-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
export class MintInteractiveRealmCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private requestRealm: string,
    private address: string,
    private fundingWIF: string,
  ) {
    this.options = checkBaseRequestOptions(this.options);
    this.requestRealm = this.requestRealm.startsWith('+') ? this.requestRealm.substring(1) : this.requestRealm;
    isValidBitworkMinimum(this.options.bitworkc);
  }
  async run(): Promise<any> {
    // Check if the request already exists
    const getExistingNameCommand = new GetByRealmCommand(this.electrumApi, this.requestRealm, AtomicalsGetFetchType.GET);
    try {
      const getExistingNameResult = await getExistingNameCommand.run();
      if (getExistingNameResult.success && getExistingNameResult.data) {
        if (getExistingNameResult.data.result && getExistingNameResult.data.result.atomical_id || getExistingNameResult.data.candidates.length) {
          throw 'Already exists with that name. Try a different name.';
        }
      }
    } catch (err: any) {
      if (err.code !== 1) {
        throw err;  // Code 1 means call correctly returned that it was not found
      }
    }

    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'nft',
      nftOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });
    // Set to request a container
    atomicalBuilder.setRequestRealm(this.requestRealm);
    // Attach a container request
    if (this.options.container)
      atomicalBuilder.setContainerMembership(this.options.container);
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

    // The receiver output
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput as any || 1000
    });
    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }
}