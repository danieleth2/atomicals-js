import { ElectrumApiInterface } from "../api/electrum-api.interface";

import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { hydrateConfig } from "../utils/hydrate-config";
import { TinySecp256k1Interface } from 'ecpair';
import * as readline from 'readline';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { GetByTickerCommand } from "./get-by-ticker-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions, isValidBitworkMinimum, isValidBitworkString, isValidTickerName } from "../utils/atomical-format-helpers";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { prepareFilesDataAsObject, readJsonFileAsCompleteDataObjectEncodeAtomicalIds } from "./command-helpers";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

const promptContinue = async (): Promise<any>  => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    let reply: string = '';
    const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
    while (reply !== 'q') {
      console.log(`Are you sure you want to continue with the details above? (y/n)`)
      console.log('-')
      reply = (await prompt("Enter your selection: ") as any);
      switch (reply) {
        case 'y':
          return true;
        default:
        throw new Error("user aborted")
      }
    }
  } finally {
    rl.close();
  }
}

export class MintInteractiveFtCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private file: string,
    private supply: number,
    private address: string,
    private requestTicker: string,
    private fundingWIF: string,
  ) {
    this.options = checkBaseRequestOptions(this.options)
    this.requestTicker = this.requestTicker.startsWith('$') ? this.requestTicker.substring(1) : this.requestTicker;
    isValidTickerName(requestTicker);
    isValidBitworkMinimum(this.options.bitworkc);
  }
  async run(): Promise<any> {

    let filesData = await readJsonFileAsCompleteDataObjectEncodeAtomicalIds(this.file, true);
    console.log('Initializing Direct FT Token')
    console.log('-----------------------')
    console.log('Total Supply (Satoshis): ', this.supply);
    console.log('Total Supply (BTC): ', this.supply / 100000000);
    let supply = this.supply;
    let decimals = 0;
    if (filesData['decimals']) {
      decimals = parseInt(filesData['decimals'], 10);
    }
    console.log('Decimals: ', decimals);

    if (!decimals || decimals === 0) {
      console.log('RECOMMENDATION: USE AT LEAST DECIMALS 1 OR 2');
    }
    
    let expandedSupply = supply;
    if (decimals > 0) {
      let decimalFactor = Math.pow(10, decimals);
      expandedSupply = supply / decimalFactor
    }
    console.log('Total Supply (With Decimals): ', expandedSupply);
    console.log('Data objects: ', filesData);
    console.log('-----------------------')

    await promptContinue();

    const getExistingNameCommand = new GetByTickerCommand(this.electrumApi, this.requestTicker, AtomicalsGetFetchType.GET, undefined);
    try {
      const getExistingNameResult = await getExistingNameCommand.run();
      if (getExistingNameResult.success && getExistingNameResult.data) {
        if (getExistingNameResult.data.result && getExistingNameResult.data.result.atomical_id || getExistingNameResult.data.candidates.length) {
          throw 'Already exists with that name. Try a different name.';
        }
      }
    } catch (err: any) {
      console.log('err', err)
      if (err.code !== 1) {
        throw err; // Code 1 means call correctly returned that it was not found
      }
    }

    const atomicalBuilder = new AtomicalOperationBuilder({
      electrumApi: this.electrumApi,
      rbf: this.options.rbf,
      satsbyte: this.options.satsbyte,
      address: this.address,
      disableMiningChalk: this.options.disableMiningChalk,
      opType: 'ft',
      ftOptions: {
        fixedSupply: this.supply,
        ticker: this.requestTicker,
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Attach any default data
    await atomicalBuilder.setData(filesData);
    // Set to request a container
    atomicalBuilder.setRequestTicker(this.requestTicker);
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
      value: this.supply
    });

    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }

}