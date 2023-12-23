import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { logBanner } from "./command-helpers";
import { AtomicalOperationBuilder, REALM_CLAIM_TYPE } from "../utils/atomical-operation-builder";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { GetByRealmCommand } from "./get-by-realm-command";
import { detectScriptToAddressType } from "../utils/address-helpers";
import { GetCommand } from "./get-command";
import { checkBaseRequestOptions, isAtomicalId } from "../utils/atomical-format-helpers";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
export class MintInteractiveSubrealmWithRulesCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private requestSubrealm: string,
    private nearestParentAtomicalId: string,
    private address: string,
    private fundingWIF: string,
    private options: BaseRequestOptions
  ) {
    this.options = checkBaseRequestOptions(this.options);
  }
  async run(): Promise<any> {

    if (this.requestSubrealm.indexOf('.') === -1) {
      throw 'Cannot mint for a top level Realm. Must be a name like +name.subname. Use the mint-realm command for a top level Realm';
    }
    const realmParts = this.requestSubrealm.split('.');
    const finalSubrealmPart = realmParts[realmParts.length - 1];

    // Step 1. Query the full realm and determine if it's already claimed
    const getSubrealmCommand = new GetByRealmCommand(this.electrumApi, this.requestSubrealm, AtomicalsGetFetchType.LOCATION, true);
    const getSubrealmReponse = await getSubrealmCommand.run();
    if (getSubrealmReponse.data.atomical_id) {
      return {
        success: false,
        msg: 'Subrealm is already claimed. Choose another Subrealm',
        data: getSubrealmReponse.data
      }
    }
    const finalSubrealmSplit = this.requestSubrealm.split('.');
    const finalSubrealm = finalSubrealmSplit[finalSubrealmSplit.length - 1];
    if (!getSubrealmReponse.data.nearest_parent_realm_atomical_id) {
      throw new Error('Nearest parent realm id is not set')
    }
    if (getSubrealmReponse.data.missing_name_parts !== finalSubrealm) {
      throw new Error(`Nearest parent realm is not the direct potential parent of the requested Subrealm. Try minting ${getSubrealmReponse.data.found_full_realm_name} first`)
    }
    const getNearestParentRealmCommand = new GetCommand(this.electrumApi, this.nearestParentAtomicalId, AtomicalsGetFetchType.LOCATION);
    const getNearestParentRealmResponse = await getNearestParentRealmCommand.run();
    if (getNearestParentRealmResponse.success && getNearestParentRealmResponse.data.atomical_id) {
      return {
        success: false,
        msg: 'Error retrieving nearest parent atomical ' + this.nearestParentAtomicalId,
        data: getSubrealmReponse.data
      }
    }
    logBanner('HOW SUBREALM MINTING WORKS. WARNING: READ CAREFULLY!')
    console.log('IMPORTANT NOTE: At anytime you may review the complete active subrealm mint rules with the command: ')
    console.log(`% npm cli realm-info ${this.requestSubrealm}`)
    console.log('getSubrealmReponse', getSubrealmReponse);
    console.log(`*** We detected that the expected active rules list for the next block (${getSubrealmReponse.data.nearest_parent_realm_subrealm_mint_rules.current_height}) are: ***`)
    console.log(JSON.stringify(getSubrealmReponse.data.nearest_parent_realm_subrealm_mint_rules.current_height_rules, null, 2));
    let index = 0;
    let matchedAtLeastOneRule = false

    if (!getSubrealmReponse.data.nearest_parent_realm_subrealm_mint_rules.current_height_rules ||
      !Object.keys(getSubrealmReponse.data.nearest_parent_realm_subrealm_mint_rules.current_height_rules).length) {
      throw new Error('The requested subrealm does not have any rules for the current height. Aborting...')
    }
    let bitworkc;
    let bitworkr;
    for (const price_point of getSubrealmReponse.data.nearest_parent_realm_subrealm_mint_rules.current_height_rules) {
      const regexRule = price_point.p;
      const outputRulesMap = price_point.o;
      bitworkc = price_point.bitworkc;
      bitworkr = price_point.bitworkr;
      const modifiedPattern = '^' + regexRule + '$';
      let regexPattern;
      try {
        regexPattern = new RegExp(modifiedPattern)
      } catch (ex) {
        // Technically that means a malformed payment *could* possibly be made and it would work.
        // But it's probably not what either party intended. Therefore warn the user and bow out.
        console.log('Realm rule regex is invalid. Contact the owner of the parent realm to tell them to fix it! Unable to continue. Aborting...');
        throw ex;
      }
      if (regexPattern.test(finalSubrealmPart)) {
        console.log(`The subrealm name of ${finalSubrealmPart} matches the rule entry at index ${index}:`);
        console.log('---------------------------------------------------------------------------------------');
        console.log('Pattern: ', modifiedPattern)
        let outputNum = 0;
        for (const propScript in outputRulesMap) {
          if (!outputRulesMap.hasOwnProperty(propScript)) {
            continue;
          }
          const priceRule = outputRulesMap[propScript]['v']
          const priceRuleTokenType = outputRulesMap[propScript]['id']
          if (priceRule < 0) {
            throw new Error('Aborting minting because price is less than 0')
          }
          if (priceRule > 100000000) {
            throw new Error('Aborting minting because price is greater than 1')
          }
          console.log('Rule entry: ', price_point);
          if (isNaN(priceRule)) {
            throw new Error('Price is not a valid number')
          }
          
          if (priceRuleTokenType && !isAtomicalId(priceRuleTokenType)) {
            throw new Error('id parameter must be a compact atomical id: ' + priceRuleTokenType);
          }

          try {
            const result = detectScriptToAddressType(propScript);
            console.log('Detected payment address: ', result)
            console.log('---------------------------------------------------------------------------------------');
          } catch (ex) {
            // Technically that means a malformed payment *could* possibly be made and it would work.
            // But it's probably not what either party intended. Therefore warn the user and bow out.
            console.log('Realm rule output format is not a valid address script. Aborting...');
            throw ex;
          }
          console.log('Payment Output #', outputNum)
          console.log('Price (Satoshis): ', priceRule)
          console.log('Price: ', priceRule / 100000000)
          outputNum++;
        }

        if (bitworkr) {
          console.log('Bitworkr required: ', bitworkr);
        }

        if (bitworkc) {
          console.log('Bitworkc required: ', bitworkc);
        }

        matchedAtLeastOneRule = true;
        break;
      }
      index++;
    }

    if (!matchedAtLeastOneRule) {
      throw new Error('The requested subrealm does not match any rule entry! Choose a different subrealm name. Aborting...')
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
    atomicalBuilder.setRequestSubrealm(this.requestSubrealm, this.nearestParentAtomicalId, REALM_CLAIM_TYPE.RULE);
    // Attach a container request
    if (this.options.container) {
      atomicalBuilder.setContainerMembership(this.options.container);
    }
    // Attach any requested bitwork
    if (bitworkc || this.options.bitworkc) {

      if (bitworkc === 'any') {
        bitworkc = undefined
      }
      atomicalBuilder.setBitworkCommit(bitworkc || this.options.bitworkc);
    }
    if (bitworkr || this.options.bitworkr) {
      if (bitworkr === 'any') {
        bitworkr = undefined
      }
      atomicalBuilder.setBitworkReveal(bitworkr || this.options.bitworkr);
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
