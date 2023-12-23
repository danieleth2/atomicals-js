import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
} from "bitcoinjs-lib";
import { IsAtomicalOwnedByWalletRecord } from "../utils/address-helpers";
import { AtomicalStatus } from "../interfaces/atomical-status.interface";
import { GetRealmInfoCommand } from "./get-subrealm-info-command";
import { IWalletRecord } from "../utils/validate-wallet-storage";
import { GetCommand } from "./get-command";
import { warnContinueAbort } from "../utils/prompt-helpers";
import { BaseRequestOptions } from "../interfaces/api.interface";
import { checkBaseRequestOptions } from "../utils/atomical-format-helpers";
import { AtomicalOperationBuilder, REALM_CLAIM_TYPE } from "../utils/atomical-operation-builder";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);

export interface ResolvedRealm {
  atomical: AtomicalStatus
}

/**
 * Mints a subrealm with the assumption that the `owner` wallet owns the parent atomical
 */
export class MintInteractiveSubrealmDirectCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private requestSubrealm: string,
    private nearestParentAtomicalId: string,
    private address: string,
    private fundingWIF: string,
    private owner: IWalletRecord,
    private options: BaseRequestOptions
  ) {
    this.options = checkBaseRequestOptions(this.options)
  }

  async run(): Promise<any> {

    if (this.requestSubrealm.indexOf('.') === -1) {
      throw 'Cannot mint for a top level Realm. Must be a name like +name.subname. Use the mint-realm command for a top level Realm';
    }

    // Step 1. Query the full realm and determine if it's already claimed
    const getSubrealmCommand = new GetRealmInfoCommand(this.electrumApi, this.requestSubrealm);
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
      throw new Error(`Nearest parent realm is not the direct potential parent of the requested Subrealm. Try minting the parents first first`)
    }
    const candidates = getSubrealmReponse.data.candidates

    if (candidates.length) {
      await warnContinueAbort('Candidate Subrealm exists already. There is no guarantee you will win the subrealm. Continue anyways (y/n)?', 'y');
    }
    const getNearestParentRealmCommand = new GetCommand( this.electrumApi, this.nearestParentAtomicalId, AtomicalsGetFetchType.LOCATION);
    const getNearestParentRealmResponse = await getNearestParentRealmCommand.run();
    if (getNearestParentRealmResponse.success && getNearestParentRealmResponse.data.atomical_id) {
      return {
        success: false,
        msg: 'Error retrieving nearest parent atomical ' + this.nearestParentAtomicalId,
        data: getNearestParentRealmResponse.data
      }
    }
    // If it's owned by self, then we can mint directly provided that there is no other candidates
    const utxoLocation = IsAtomicalOwnedByWalletRecord(this.owner.address, getNearestParentRealmResponse.data.result);
    if (!utxoLocation) {
      throw new Error('Parent realm is not owned by self')
    }
    if (this.nearestParentAtomicalId !== getNearestParentRealmResponse.data.result.atomical_id) {
      throw new Error('Provided parent id does not match the current location of the parent realm')
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

    // For direct mints we must spent the parent realm atomical in the same transaction
    atomicalBuilder.addInputUtxo(utxoLocation, this.owner.WIF)
    
    // The first output will be the location of the subrealm minted
    atomicalBuilder.addOutput({
      address: this.address,
      value: this.options.satsoutput as number,
    });

    // ... and make sure to assign an output to capture the spent parent realm atomical
    atomicalBuilder.addOutput({
      address: utxoLocation.address,
      value: utxoLocation.witnessUtxo.value
    });
 
    // Set to request a container
    atomicalBuilder.setRequestSubrealm(this.requestSubrealm, this.nearestParentAtomicalId, REALM_CLAIM_TYPE.DIRECT);
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