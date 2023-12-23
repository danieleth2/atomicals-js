import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import * as readline from 'readline';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import * as qrcode from 'qrcode-terminal';
import {
  initEccLib,
  networks,
} from "bitcoinjs-lib";

import { jsonFileWriter } from "../utils/file-utils";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
import { AtomicalIdentifierType, AtomicalResolvedIdentifierReturn, decorateAtomical, getAtomicalIdentifierType } from "../utils/atomical-format-helpers";
import { toXOnly } from "../utils/create-key-pair";
import { AtomicalStatus } from "../interfaces/atomical-status.interface";
import { getKeypairInfo, KeyPairInfo } from "../utils/address-keypair-path";
import { NETWORK, RBF_INPUT_SEQUENCE, calculateFundsRequired, logBanner } from "./command-helpers";
import { GetCommand } from "./get-command";
import { GetByRealmCommand } from "./get-by-realm-command";
import { GetByContainerCommand } from "./get-by-container-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);

export class TransferInteractiveNftCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private atomicalAliasOrId: string,
    private currentOwnerAtomicalWIF: string,
    private receiveAddress: string,
    private fundingWIF: string,
    private satsbyte: number,
    private satsoutput: number,
  ) {
  }
  async run(): Promise<any> {
    detectAddressTypeToScripthash(this.receiveAddress);
    const keypairAtomical = ECPair.fromWIF(this.currentOwnerAtomicalWIF);
    const keypairFunding = ECPair.fromWIF(this.fundingWIF);
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keypairAtomical.publicKey),
      network: NETWORK
    });

    const atomicalType: AtomicalResolvedIdentifierReturn = getAtomicalIdentifierType(this.atomicalAliasOrId);
    let cmd;
    if (atomicalType.type === AtomicalIdentifierType.ATOMICAL_ID || atomicalType.type === AtomicalIdentifierType.ATOMICAL_NUMBER) {
      cmd = new GetCommand(this.electrumApi, atomicalType.providedIdentifier || '', AtomicalsGetFetchType.GET);
    } else if (atomicalType.type === AtomicalIdentifierType.REALM_NAME) {
      cmd = new GetByRealmCommand(this.electrumApi, atomicalType.realmName || '', AtomicalsGetFetchType.GET);
    } else if (atomicalType.type === AtomicalIdentifierType.CONTAINER_NAME) {
      cmd = new GetByContainerCommand(this.electrumApi, atomicalType.containerName || '', AtomicalsGetFetchType.GET);
    } else {
      throw 'Atomical identifier is invalid. Use a realm name, container name or atomicalId or atomical number';
    }
    const cmdResult = await cmd.run();

    if (!cmdResult.success) {
      throw 'Unable to resolve Atomical.';
    }
    console.log("====================================================================")
    console.log("Transfer Interactive (NFT)")
    console.log("====================================================================")
    const atomicalId = cmdResult.data.result.atomical_id;
    const atomicalNumber = cmdResult.data.result.atomical_number;
    console.log(`Atomical Id: ${atomicalId}`);
    console.log(`Atomical Number: ${atomicalNumber}`);
    if (cmdResult.data.result.$container) {
      console.log('Container Name: ', cmdResult.data.result.$container);
    }
    if (cmdResult.data.result.$full_realm_name) {
      console.log('Full Realm Name: ', cmdResult.data.result.$full_realm_name);
    }
    console.log('Expected existing address owner of the private key (WIF) provided: ', p2tr.address);
    console.log("Satoshis amount to add into the Atomical at transfer:", this.satsoutput);
    console.log("Requested fee rate satoshis/byte:", this.satsbyte);
    const atomicalInfo = await this.electrumApi.atomicalsGetLocation(atomicalId);
    const atomicalDecorated = decorateAtomical(atomicalInfo.result);
    console.log(JSON.stringify(atomicalDecorated, null, 2))
    // Check to make sure that the location is controlled by the same address as supplied by the WIF
    if (!atomicalDecorated.location_info_obj || !atomicalDecorated.location_info_obj.locations || !atomicalDecorated.location_info_obj.locations.length || atomicalDecorated.location_info_obj.locations[0].address !== p2tr.address) {
      throw `Atomical is controlled by a different address (${atomicalDecorated.location_info_obj.locations[0].address}) than the provided wallet (${p2tr.address})`;
    }

    if (atomicalDecorated.location_info_obj.locations[0].atomicals_at_location.length > 1) {
      throw `Multiple atomicals are located at the same address as the NFT. Use the splat command to separate them first.`;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
    try {
      const cont: any = await prompt("Proceed with transfer? Type 'y' to continue: ");
      if (cont.toLowerCase() === 'y') {
        const txid = await this.performTransfer(
          atomicalDecorated,
          keypairAtomical,
          keypairFunding,
          this.satsbyte,
          this.satsoutput,
          this.receiveAddress
        );
        return {
          success: true,
          data: {
            txid
          }
        }
      } else {
        console.log("Cancelled");
        return {
          success: false,
          message: "Cancelled transfer"
        }
      }
    } catch (e: any) {
      console.log('e', e.toString())
      return {
        success: false,
        message: e,
        e: e.toString()
      }
    } finally {
      rl.close();
    }
  }

  async performTransfer(
    atomical: AtomicalStatus,
    atomicalKeypair: any,
    fundingKeypair: any,
    satsbyte: number,
    satsoutput: number,
    receiveAddress: string
  ) {
    const keypairAtomical: KeyPairInfo = getKeypairInfo(atomicalKeypair)
    if (atomical.type !== 'NFT') {
      throw 'Atomical is not an NFT. It is expected to be an NFT type';
    }

    if (!atomical.location_info_obj || !atomical.location_info_obj.locations || !atomical.location_info_obj.locations.length || atomical.location_info_obj.locations[0].address !== keypairAtomical.address) {
      throw "Provided atomical WIF does not match the location address of the Atomical"
    }
    const keypairFundingInfo: KeyPairInfo = getKeypairInfo(fundingKeypair)
    console.log('Funding address of the funding private key (WIF) provided: ', keypairFundingInfo.address);
    logBanner('Preparing Funding Fees...');

    if (!atomical.location_info_obj || atomical.location_info_obj.locations.length !== 1) {
      throw 'expected exactly one location_info for NFT Atomical';
    }
    const location = atomical.location_info_obj.locations[0];
    const { expectedSatoshisDeposit } = calculateFundsRequired(location.value, satsoutput, satsbyte, 0);
    const psbt = new bitcoin.Psbt({ network: NETWORK })
    // Add the atomical input, the value from the input counts towards the total satoshi amount required
    psbt.addInput({
      sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
      hash: location.txid,
      index: location.index,
      witnessUtxo: { value: location.value, script: Buffer.from(location.script, 'hex') },
      tapInternalKey: keypairAtomical.childNodeXOnlyPubkey,
    })
    // There is a funding deficit
    // Could fund with the atomical input value, but we wont
    // const requiresDeposit = expectedSatoshisDeposit > 0;
  
    logBanner(`DEPOSIT ${expectedSatoshisDeposit / 100000000} BTC to ${keypairFundingInfo.address}`);
    qrcode.generate(keypairFundingInfo.address, { small: false });
    console.log(`...`)
    console.log(`...`)
    console.log(`WAITING UNTIL ${expectedSatoshisDeposit / 100000000} BTC RECEIVED AT ${keypairFundingInfo.address}`)
    console.log(`...`)
    console.log(`...`)
    let utxo = await this.electrumApi.waitUntilUTXO(keypairFundingInfo.address, expectedSatoshisDeposit, 5, false);
    console.log(`Detected UTXO (${utxo.txid}:${utxo.vout}) with value ${utxo.value} for funding the transfer operation...`);
    // Add the funding input
    psbt.addInput({
      sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
      hash: utxo.txid,
      index: utxo.outputIndex,
      witnessUtxo: { value: utxo.value, script: keypairFundingInfo.output },
      tapInternalKey: keypairFundingInfo.childNodeXOnlyPubkey,
    })
    psbt.addOutput({
      value: this.satsoutput,
      address: receiveAddress,
    })
    const isMoreThanDustChangeRemaining = utxo.value - expectedSatoshisDeposit >= 546;
    if (isMoreThanDustChangeRemaining) {
      // Add change output
      console.log(`Adding change output, remaining: ${utxo.value - expectedSatoshisDeposit}`)
      psbt.addOutput({
        value: utxo.value - expectedSatoshisDeposit,
        address: keypairFundingInfo.address
      })
    }
    psbt.signInput(0, keypairAtomical.tweakedChildNode)
    psbt.signInput(1, keypairFundingInfo.tweakedChildNode)
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawtx = tx.toHex();
    console.log(`Constructed Atomicals NFT Transfer, attempting to broadcast: ${tx.getId()}`);
    let broadcastedTxId = await this.electrumApi.broadcast(rawtx);
    console.log(`Success!`);
    return broadcastedTxId
  }

}