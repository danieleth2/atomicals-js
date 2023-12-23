import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { AtomicalOperationBuilder, ParentInputAtomical } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { GetByContainerCommand } from "./get-by-container-command";
import { checkBaseRequestOptions, isValidBitworkMinimum, isValidBitworkString } from "../utils/atomical-format-helpers";
import { getAndCheckAtomicalInfo } from "./command-helpers";
import { getKeypairInfo } from "../utils/address-keypair-path";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
export class MintInteractiveContainerCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private requestContainer: string,
    private address: string,
    private fundingWIF: string,

  ) {
    this.options = checkBaseRequestOptions(this.options)
    this.requestContainer = this.requestContainer.startsWith('#') ? this.requestContainer.substring(1) : this.requestContainer;
    isValidBitworkMinimum(this.options.bitworkc);
  }
  async run(): Promise<any> {
    // Check if the request already exists
    const getExistingNameCommand = new GetByContainerCommand(this.electrumApi, this.requestContainer, AtomicalsGetFetchType.GET, undefined);
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
    atomicalBuilder.setRequestContainer(this.requestContainer);
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
      const { atomicalInfo, locationInfo, inputUtxoPartial } = await getAndCheckAtomicalInfo(this.electrumApi, this.options.parent, this.options.parentOwner?.address as any);
      const parentKeypairInput = ECPair.fromWIF(this.options.parentOwner?.WIF as any);
      const parentKeypairInputInfo = getKeypairInfo(parentKeypairInput)
      const inp: ParentInputAtomical = {
        parentId: this.options.parent,
        parentUtxoPartial: inputUtxoPartial,
        parentKeyInfo: parentKeypairInputInfo
      }
      atomicalBuilder.setInputParent(inp)
    }

    if (this.options.parent) {
      atomicalBuilder.setInputParent(await AtomicalOperationBuilder.resolveInputParent(this.electrumApi, this.options.parent, this.options.parentOwner as any))
    }

    // The receiver output of the mint
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput as any
    })

    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }
}