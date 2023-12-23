import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
import { GetByContainerCommand } from "./get-by-container-command";
import { jsonFileReader } from "../utils/file-utils";
import { AtomicalOperationBuilder } from "../utils/atomical-operation-builder";
import { GetContainerItemValidatedCommand } from "./get-container-item-validated-command";
import { hash256 } from "bitcoinjs-lib/src/crypto";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);

export class MintInteractiveDitemCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private container: string,
    private requestDmitem: string,
    private manifestJsonFile: string,
    private address: string,
    private fundingWIF: string,
  ) {
    this.options = checkBaseRequestOptions(this.options)
    this.container = this.container.startsWith('#') ? this.container.substring(1) : this.container;
  }

  async run(): Promise<any> {
    try {
      detectAddressTypeToScripthash(this.address);
      console.log("Initial mint address:", this.address);
    } catch (ex) {
      console.log('Error validating initial owner address');
      throw ex;
    }
    const getCmd = new GetByContainerCommand(this.electrumApi, this.container, AtomicalsGetFetchType.GET);
    const getResponse = await getCmd.run();
    if (!getResponse.success || !getResponse.data.result.atomical_id) {
      return {
        success: false,
        msg: 'Error retrieving container parent atomical ' + this.container,
        data: getResponse.data
      }
    }

    // Step 0. Get the details from the manifest
    const parentContainerId = getResponse.data.result.atomical_id;
    const jsonFile: any = await jsonFileReader(this.manifestJsonFile);
    const expectedData = jsonFile['data'];
    if (expectedData['args']['request_dmitem'] !== this.requestDmitem) {
      throw new Error('Mismatch item id')
    }
    const fileBuf = Buffer.from(expectedData[expectedData['args']['main']]['$b'], 'hex')
    const main = expectedData['args']['main']
    const mainHash = hash256(fileBuf).toString('hex')
    const proof = expectedData['args']['proof']

    // Step 1. Query the container item to see if it's taken
    const getItemCmd = new GetContainerItemValidatedCommand(this.electrumApi, this.container, this.requestDmitem, 'any', 'any', main, mainHash, proof, false);
    const getItemCmdResponse = await getItemCmd.run();
    const data = getItemCmdResponse.data;
    console.log(getItemCmdResponse)
    if (data.atomical_id) {
      throw new Error('Container item is already claimed. Choose another item')
    }
    if (!data.proof_valid) {
      throw new Error('Item proof is invalid')
    }
    if (data.status) {
      throw new Error(`Item already contains status: ${data.status}`)
    }
    if (!data.applicable_rule) {
      throw new Error('No applicable rule')
    }
    if (data.applicable_rule.bitworkc || expectedData['args']['bitworkc']) {
      if (data.applicable_rule.bitworkc && expectedData['args']['bitworkc'] && (data.applicable_rule.bitworkc !== expectedData['args']['bitworkc'] && data.applicable_rule.bitworkc !== 'any')) {
        throw new Error('applicable_rule bitworkc is not compatible with the item args bitworkc')
      }
    }
    if (data.applicable_rule.bitworkr || expectedData['args']['bitworkr']) {
      if (data.applicable_rule.bitworkr && expectedData['args']['bitworkr'] && (data.applicable_rule.bitworkr !== expectedData['args']['bitworkr'] && data.applicable_rule.bitworkr !== 'any')) {
        throw new Error('applicable_rule bitworkr is not compatible with the item args bitworkr')
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
      verbose: true
    });

    // Set to request a container
    atomicalBuilder.setRequestItem(this.requestDmitem, parentContainerId);

    atomicalBuilder.setData({
      [expectedData['args']['main']]: fileBuf
    });

    // Attach any requested bitwork
    atomicalBuilder.setBitworkCommit(data.applicable_rule.bitworkc || expectedData['args']['bitworkc']);
    atomicalBuilder.setBitworkReveal(data.applicable_rule.bitworkr || expectedData['args']['bitworkr']);

    atomicalBuilder.setArgs({
      ...expectedData['args']
    });
    
     // The receiver output
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput as any || 1000
    });
    const result = await atomicalBuilder.start(this.fundingWIF);
    
    return {
      success: true,
      data: result,
    }
  }
}
