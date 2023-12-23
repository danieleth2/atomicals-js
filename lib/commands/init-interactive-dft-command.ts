import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
import * as readline from 'readline';
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { GetByTickerCommand } from "./get-by-ticker-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { BitworkInfo, checkBaseRequestOptions, isValidBitworkMinimum, isValidBitworkString } from "../utils/atomical-format-helpers";
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

export class InitInteractiveDftCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private file: string,
    private address: string,
    private requestTicker: string,
    private mintAmount: number,
    private maxMints: number,
    private mintHeight: number,
    private mintBitworkc: string | null,
    private mintBitworkr: string | null,
    private fundingWIF: string,
  ) {
    this.options = checkBaseRequestOptions(this.options);
    this.requestTicker = this.requestTicker.startsWith('$') ? this.requestTicker.substring(1) : this.requestTicker;
    isValidBitworkMinimum(this.options.bitworkc);

    if (this.maxMints > 500000 || this.maxMints < 1) {
      throw new Error('max mints must be between 1 and 500,000')
    }
    
    if (this.mintAmount > 100000000 || this.mintAmount < 546) {
      throw new Error('mint amount must be between 546 and 100,000,000')
    }
  }
  async run(): Promise<any> {
    // let filesData = await prepareFilesDataAsObject(this.files);
    let filesData = await readJsonFileAsCompleteDataObjectEncodeAtomicalIds(this.file, true);
    console.log('Initializing Decentralized FT Token')
    console.log('-----------------------')
    let supply = this.maxMints * this.mintAmount;
    console.log('Total Supply (Satoshis): ', supply);
    console.log('Total Supply (BTC): ', supply / 100000000);

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

    console.log('Max mints', this.maxMints);
    console.log('Mint Amount', this.mintAmount);
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
      opType: 'dft',
      dftOptions: {
        mintAmount: Number(this.mintAmount),
        maxMints: Number(this.maxMints),
        mintHeight: Number(this.mintHeight),
        ticker: this.requestTicker,
      },
      meta: this.options.meta,
      ctx: this.options.ctx,
      init: this.options.init,
    });

    // Attach any default data
    await atomicalBuilder.setData(filesData);

    const args = {
      mint_amount: Number(this.mintAmount),
      mint_height: Number(this.mintHeight),
      max_mints: Number(this.maxMints),
    };

    let mintBitworkCommitInfo: BitworkInfo | null = null;
    if (this.mintBitworkc) {
      mintBitworkCommitInfo = isValidBitworkString(this.mintBitworkc)
      args['mint_bitworkc'] = mintBitworkCommitInfo?.hex_bitwork;
    }

    let mintBitworkRevealInfo: BitworkInfo | null = null;
    if (this.mintBitworkr) {
      mintBitworkRevealInfo = isValidBitworkString(this.mintBitworkr)
      args['mint_bitworkr'] = mintBitworkRevealInfo?.hex_bitwork;
    }

    atomicalBuilder.setArgs(args);
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
      value: this.options.satsoutput as any || 1000
    });

    const result = await atomicalBuilder.start(this.fundingWIF);
    return {
      success: true,
      data: result
    }
  }

}