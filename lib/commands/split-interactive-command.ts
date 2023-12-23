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
import { hasAtomicalType, isAtomicalId } from "../utils/atomical-format-helpers";

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

export class SplitInteractiveCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private locationId: string,
    private owner: IWalletRecord,
    private funding: IWalletRecord,
  ) {
  }
  async run(): Promise<any> {
    logBanner(`Split FTs Interactive`);
    const command: CommandInterface = new GetAtomicalsAtLocationCommand(this.electrumApi, this.locationId);
    const response: any = await command.run();
    if (!response || !response.success) {
      throw new Error(response);
    }
    const atomicals = response.data.atomicals;
    const atomicalFts = atomicals.filter((item) => {
      return item.type === 'FT';
    });

    console.log('Found multiple FTs at the same location: ', atomicalFts);

    const hasNfts = hasAtomicalType('NFT', atomicals);
    if (hasNfts) {
      console.log('Found at least one NFT at the same location. The first output will contain the NFTs, and the second output, etc will contain the FTs split out. After you may use the splat command to separate multiple NFTs if they exist at the same location.')
    }

    if (!hasNfts && atomicalFts.length <= 1) {
      throw new Error('Multiple FTs were not found at the same location. Nothing to skip split.');
    }

    const inputUtxoPartial: IInputUtxoPartial | any = GetUtxoPartialFromLocation(this.owner.address, response.data.location_info);
    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.owner.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'y',
      skipOptions: {
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Add the owner of the atomicals at the location
    atomicalBuilder.addInputUtxo(inputUtxoPartial, this.owner.WIF)
    // ... and make sure to assign outputs to capture each atomical split
    const ftsToSplit: any = {}
    let amountSkipped = 0;
    if (hasNfts) {
      atomicalBuilder.addOutput({
        address: inputUtxoPartial.address,
        value: inputUtxoPartial.witnessUtxo.value
      });
      amountSkipped += inputUtxoPartial.witnessUtxo.value;
    }
    if (isNaN(amountSkipped)) {
      throw new Error('Critical error amountSkipped isNaN');
    }
    for (const ft of atomicalFts) {
      if (!ft.atomical_id) {
        throw new Error('Critical error atomical_id not set for FT');
      }
      if (!isAtomicalId(ft.atomical_id)) {
        throw new Error('Critical error atomical_id is not valid for FT');
      }
      // Make sure to make N outputs, for each atomical NFT
      ftsToSplit[ft.atomical_id] = amountSkipped;
      atomicalBuilder.addOutput({
        address: inputUtxoPartial.address,
        value: inputUtxoPartial.witnessUtxo.value
      });
      // Add the amount to skip for the next FT
      amountSkipped += inputUtxoPartial.witnessUtxo.value;
      if (isNaN(amountSkipped)) {
        throw new Error('Critical error amountSkipped isNaN');
      }
    }
    await atomicalBuilder.setData(ftsToSplit);
    const result = await atomicalBuilder.start(this.funding.WIF);
    return {
      success: true,
      data: result
    }
  }
}


