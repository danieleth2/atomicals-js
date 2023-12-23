import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { logBanner } from "./command-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";
import { GetAtomicalsAtLocationCommand } from "./get-atomicals-at-location-command";
import { GetUtxoPartialFromLocation } from "../utils/address-helpers";
import { IInputUtxoPartial } from "../types/UTXO.interface";
import { hasAtomicalType } from "../utils/atomical-format-helpers";

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

export class SplatInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private locationId: string,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
  ) {
  }
  async run(): Promise<any> {
    logBanner(`Splat Interactive`);
    const command: CommandInterface = new GetAtomicalsAtLocationCommand(this.electrumApi, this.locationId);
    const response: any = await command.run();

    if (!response || !response.success) {
      throw new Error(response);
    }
    const atomicals = response.data.atomicals;
    const atomicalNfts = atomicals.filter((item) => {
      return item.type === 'NFT';
    });
    if (atomicalNfts.length <= 1) {
      throw new Error('Multiple NFTs were not found at the same location. Nothing to skip split out.');
    }
    const hasFts = hasAtomicalType('FT', atomicals);
    if (hasFts) {
      throw new Error('Splat operation attempted for a location which contains non-NFT type atomicals. Detected FT type. Use Split operation first. Aborting...');
    }

    const inputUtxoPartial: IInputUtxoPartial | any = GetUtxoPartialFromLocation(this.owner.address, response.data.location_info);
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.owner.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'x',
      splatOptions: {
        satsoutput: this.options.satsoutput as any
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Add the owner of the atomicals at the location
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)
    // ... and make sure to assign outputs to capture each atomical splatted out
    let amountSkipped = 0;
    atomicalBuilder.addOutput({
      address: inputUtxoPartial.address,
      value: inputUtxoPartial.witnessUtxo.value
    });
    if (this.options.bitworkc) {
      atomicalBuilder.setBitworkCommit(this.options.bitworkc);
    }
    amountSkipped += inputUtxoPartial.witnessUtxo.value;
    for (const nft of atomicalNfts) {
      // We do not actually need to know which atomical it is, just that we create an output for each
      // Make sure to make N outputs, for each atomical NFT
      atomicalBuilder.addOutput({
        address: inputUtxoPartial.address,
        value: this.options.satsoutput as any || 1000
      });
    }
    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }
}


