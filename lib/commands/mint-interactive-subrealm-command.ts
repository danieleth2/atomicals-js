import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { IsAtomicalOwnedByWalletRecord, detectAddressTypeToScripthash } from "../utils/address-helpers";
import { logBanner } from "./command-helpers";
import { AtomicalStatus } from "../interfaces/atomical-status.interface";
import { IWalletRecord } from "../utils/validate-wallet-storage";
import { GetCommand } from "./get-command";
import { MintInteractiveSubrealmDirectCommand } from "./mint-interactive-subrealm-direct-command";
import { GetRealmInfoCommand } from "./get-subrealm-info-command";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { MintInteractiveSubrealmWithRulesCommand } from "./mint-interactive-subrealm-with-rules-command";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);

export interface ResolvedRealm {
  atomical: AtomicalStatus
}

export class MintInteractiveSubrealmCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private requestSubRealm: string,
    private address: string,
    private fundingWIF: string,
    private owner: IWalletRecord,
  ) {
    this.options = checkBaseRequestOptions(this.options)
    this.requestSubRealm = this.requestSubRealm.startsWith('+') ? this.requestSubRealm.substring(1) : this.requestSubRealm;
  }

  async run(): Promise<any> {

    if (this.requestSubRealm.indexOf('.') === -1) {
      throw 'Cannot mint for a top level Realm. Must be a name like +name.subname. Use the mint-realm command for a top level Realm';
    }

    const realmParts = this.requestSubRealm.split('.');
    const finalSubrealmPart = realmParts[realmParts.length - 1];
    // Validate that the addresses are valid
    try {
      detectAddressTypeToScripthash(this.address);
      console.log("Initial mint address:", this.address);
    } catch (ex) {
      console.log('Error validating initial owner address');
      throw ex;
    }
    // Step 1. Query the full realm and determine if it's already claimed
    const getSubrealmCommand = new GetRealmInfoCommand(this.electrumApi, this.requestSubRealm);
    const getSubrealmReponse = await getSubrealmCommand.run();
    console.log('getSubrealmReponse', JSON.stringify(getSubrealmReponse.data, null, 2));

    if (getSubrealmReponse.data.atomical_id) {
      return {
        success: false,
        msg: 'Subrealm is already claimed. Choose another Subrealm',
        data: getSubrealmReponse.data
      }
    }
    // Step 2. Check to make sure the only missing part is the requested subrealm itself
    if (getSubrealmReponse.data.missing_name_parts !== finalSubrealmPart) {
      return {
        success: false,
        msg: 'Subrealm cannot be minted because at least one other realm parent is missing. Mint that realm first if possible.',
        data: getSubrealmReponse.data
      }
    }
    // Step 3. Check if the nearest parent is actually a parent realm that the current client already owns by fetching and comparing the address
    // at the location
    const nearestParentAtomicalId = getSubrealmReponse.data.nearest_parent_realm_atomical_id;
    const getNearestParentRealmCommand = new GetCommand(this.electrumApi, nearestParentAtomicalId, AtomicalsGetFetchType.LOCATION);
    const getNearestParentRealmResponse = await getNearestParentRealmCommand.run();
    if (getNearestParentRealmResponse.success && getNearestParentRealmResponse.data.atomical_id) {
      return {
        success: false,
        msg: 'Error retrieving nearest parent atomical ' + nearestParentAtomicalId,
        data: getNearestParentRealmResponse.data
      }
    }

    // If it's owned by self, then we can mint directly provided that there is no other candidates
    if (IsAtomicalOwnedByWalletRecord(this.owner.address, getNearestParentRealmResponse.data.result)) {
      logBanner('DETECTED PARENT REALM IS OWNED BY SELF');
      const commandMintDirect = new MintInteractiveSubrealmDirectCommand(
        this.electrumApi,
        this.requestSubRealm,
        nearestParentAtomicalId,
        this.address,
        this.fundingWIF,
        this.owner,
        this.options);
      const commandMintDirectResponse = await commandMintDirect.run();
      if (commandMintDirectResponse.success) {
        return {
          success: true,
          data: commandMintDirectResponse.data
        }
      } else {
        return {
          success: false,
          data: commandMintDirectResponse.data
        }
      }
    } else {
      logBanner('DETECTED PARENT REALM IS NOT OWNED BY PROVIDED --OWNER WALLET');
      console.log('Proceeding to mint with the available subrealm minting rules (if available)...')
      const commandMintWithRules = new MintInteractiveSubrealmWithRulesCommand(
        this.electrumApi,
        this.requestSubRealm,
        nearestParentAtomicalId,
        this.address,
        this.fundingWIF,
        this.options);
      const commandMintWithRulesResponse = await commandMintWithRules.run();
      if (commandMintWithRulesResponse.success) {
        return {
          success: true,
          data: commandMintWithRulesResponse.data
        }
      } return {
        success: false,
        data: commandMintWithRulesResponse.data
      }
    }
  }
}