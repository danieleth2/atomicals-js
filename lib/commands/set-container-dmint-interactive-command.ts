import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { getAndCheckAtomicalInfo, logBanner, readJsonFileAsCompleteDataObjectEncodeAtomicalIds } from "./command-helpers";
import { isValidBitworkString } from "../utils/atomical-format-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

interface DmintManifestInteface {
  v: string,
  mint_height: number,
  items: number,
  rules: {
    o?: { [script: string]: {v: number, id?: string} },
    p: string,
    bitworkc?: string,
    bitworkr?: string,
  }[],
}

export function validateDmint(
  obj: {dmint?: DmintManifestInteface} | undefined,
) {
  if (!obj) {
    return false;
  }
  const dmint = obj.dmint;
  if (!dmint) {
    return false;
  }
  for (const {o, p, bitworkc, bitworkr} of dmint.rules) {
      try {
          new RegExp(p);
      } catch (e) {
          throw `Invalid pattern: ${p}.\n${e}`;
      }
      if (bitworkc && !isValidBitworkString(bitworkc)) {
          return false;
      }
      if (bitworkr && !isValidBitworkString(bitworkr)) {
          return false;
      }
  }
  const mh = dmint.mint_height;
  if (mh === 0) {
    return true;
  }
  if (mh != undefined) {
    if (isNaN(mh)) {
      return false;
    }
    if (mh < 0 || mh > 10000000) {
      return false;
    }
  }
  return false;
}

export class SetContainerDmintInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private containerName: string,
    private filename: string,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
  ) {

  }
  async run(): Promise<any> {
    logBanner(`Set Container Data Interactive`);
    // Attach any default data
    let filesData = await readJsonFileAsCompleteDataObjectEncodeAtomicalIds(this.filename, false);

    if (!validateDmint(filesData)) {
      throw new Error('Invalid dmint');
    }
    const { atomicalInfo, locationInfo, inputUtxoPartial } = await getAndCheckAtomicalInfo(this.electrumApi, this.containerName, this.owner.address, 'NFT', 'container');
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
    await atomicalBuilder.setData(filesData);

    // Attach any requested bitwork
    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }
    // Add the atomical to update
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)

    // The receiver output
    atomicalBuilder.addOutput({
      address: this.owner.address,
      value: this.options.satsoutput as any || 1000// todo: determine how to auto detect the total input and set it to that
    });

    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }
}