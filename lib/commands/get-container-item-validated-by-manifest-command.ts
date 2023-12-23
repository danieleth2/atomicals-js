import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { AtomicalStatus } from "../interfaces/atomical-status.interface";
import { GetByContainerCommand } from "./get-by-container-command";
import { jsonFileReader } from "../utils/file-utils";
import { GetContainerItemValidatedCommand } from "./get-container-item-validated-command";
import { hash256 } from "bitcoinjs-lib/src/crypto";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
export interface ResolvedRealm {
  atomical: AtomicalStatus
}
export class GetContainerItemValidatedByManifestCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private container: string,
    private requestDmitem: string,
    private manifestJsonFile: string
  ) {
  
    this.container = this.container.startsWith('#') ? this.container.substring(1) : this.container;
  }
  async run(): Promise<any> {
    const getCmd = new GetByContainerCommand(this.electrumApi, this.container, AtomicalsGetFetchType.GET);
    const getResponse = await getCmd.run();
    if (!getResponse.success || !getResponse.data.result.atomical_id) {
      return {
        success: false,
        msg: 'Error retrieving container parent atomical ' + this.container,
        data: getResponse.data
      }
    }
    const parentContainerId = getResponse.data.result.atomical_id;
    // Step 0. Get the details from the manifest
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
    let bitworkc = 'any';
    let bitworkr = 'any';
    if (expectedData['args']['bitworkc']) {
      bitworkc = expectedData['args']['bitworkc'];
    }
    if (expectedData['args']['bitworkr']) {
      bitworkr = expectedData['args']['bitworkr'];
    }
    const getItemCmd = new GetContainerItemValidatedCommand(this.electrumApi, this.container, this.requestDmitem, bitworkc, bitworkr, main, mainHash, proof, true);
    const getItemCmdResponse = await getItemCmd.run();
    console.log('getItemCmdResponse', getItemCmdResponse)
    return {
      success: true,
      data: getItemCmdResponse
    }
  }
}