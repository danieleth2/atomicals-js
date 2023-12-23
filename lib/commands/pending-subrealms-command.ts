import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash, detectScriptToAddressType } from "../utils/address-helpers";
import * as readline from 'readline';
import * as chalk from 'chalk';
import { KeyPairInfo, getKeypairInfo } from "../utils/address-keypair-path";
import { NETWORK, RBF_INPUT_SEQUENCE, logBanner } from "./command-helpers";
import * as ecc from 'tiny-secp256k1';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import * as qrcode from 'qrcode-terminal';
import {
  initEccLib,
  networks,
} from "bitcoinjs-lib";

; import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);

import { jsonFileWriter } from "../utils/file-utils";
import { compactIdToOutpoint } from "../utils/atomical-format-helpers";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from "../types/protocol-tags";
import { ApplicableRule } from "../interfaces/atomical-status.interface";
import { BaseRequestOptions } from "../interfaces/api.interface";

export interface PendingSubrealmsCommandResultInterface {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

export interface PendingSummaryItemInterface {
  atomical_id: string;
  atomical_number: number;
  request_full_realm_name: string;
  full_realm_name?: string;
  status: string;
}
export interface PendingSummaryItemMapInterface {
  [key: string]: PendingSummaryItemInterface | any;
}

export interface SubrealmAwaitingPaymentItemInterface {
  atomical_id: string;
  atomical_number: number;
  request_full_realm_name: string;
  status: {
    status: string;
    pending_candidate_atomical_id?: string;
    note?: string;
  };
  make_payment_from_height?: number;
  payment_due_no_later_than_height?: number;
  applicable_rule?: ApplicableRule;
}

export class PendingSubrealmsCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private options: BaseRequestOptions,
    private address: string,
    private fundingWIF: string,
    private satsbyte: number,
    private display: boolean,
  ) {
  }
  static isCurrentAtomicalPendingCandidate(entry): boolean {
    return entry['request_subrealm_status']['pending_candidate_atomical_id'] == entry['atomical_id'];
  }
  static isPendingCandidate(entry): boolean {
    switch (entry['request_subrealm_status']['status']) {
      case 'pending_awaiting_confirmations_payment_received_prematurely':
      case 'pending_awaiting_confirmations_for_payment_window':
      case 'pending_awaiting_confirmations':
      case 'pending_awaiting_payment':
        if (PendingSubrealmsCommand.isCurrentAtomicalPendingCandidate(entry))
          return true
      default:
    }

    return false;
  }
  async run(): Promise<any> {
    const keypairFunding = ECPair.fromWIF(this.fundingWIF);
    const { scripthash } = detectAddressTypeToScripthash(this.address);
    let res = await this.electrumApi.atomicalsByScripthash(scripthash, true);
    const statusMap: PendingSummaryItemMapInterface = {}
    const current_block_height = res.global.height;
    for (const prop in res.atomicals) {
      if (!res.atomicals.hasOwnProperty(prop)) {
        continue;
      }
      const entry = res.atomicals[prop];
      if (entry.type !== 'NFT') {
        continue;
      }
      if (!entry.subtype || entry.subtype !== 'request_subrealm') {
        continue;
      }
      const entryStatus = entry['request_subrealm_status']['status'];
      if (!PendingSubrealmsCommand.isPendingCandidate(entry)) {
        continue;
      }
      let candidateInfo: any = null;
      for (const candidate of entry['subrealm_candidates']) {
        if (candidate['atomical_id'] == entry['atomical_id']) {
          candidateInfo = candidate;
          break;
        }
      }
      // It is a pending for the current atomical
      statusMap[entry.subtype] = statusMap[entry.subtype] || {}
      statusMap[entry.subtype][entryStatus] = statusMap[entry.subtype][entryStatus] || []
      const obj: SubrealmAwaitingPaymentItemInterface = {
        atomical_id: entry['atomical_id'],
        atomical_number: entry['atomical_number'],
        request_full_realm_name: entry['request_full_realm_name'],
        status: entry['request_subrealm_status'],
        payment_type: entry['payment_type'],
        ...entry
      }
      if (candidateInfo.payment_type == 'applicable_rule') {
        obj['make_payment_from_height'] = candidateInfo['make_payment_from_height']
        obj['payment_due_no_later_than_height'] = candidateInfo['payment_due_no_later_than_height']
        obj['applicable_rule'] = candidateInfo['applicable_rule']
      }
      statusMap[entry.subtype][entryStatus].push(obj)
    }
    const statusReturn = {
      current_block_height,
      ...statusMap,
    };

    this.makePrettyMenu(statusReturn);

    if (this.display) {
      console.log('display on')
      return {
        success: true,
        data: statusReturn
      }
    }
    let selection: any = await this.promptSubrealmSelection(statusReturn['request_subrealm']['pending_awaiting_payment']);
    if (!selection) {
      return {
        success: false,
        data: statusReturn
      }
    }
    // overide to test sending premature payments
    // selection = statusReturn['request_subrealm']['pending_awaiting_confirmations_for_payment_window'][0];
    const expectedPaymentOutputsMap = selection['applicable_rule']['matched_rule']['o'];
    const paymentOutputs: any= [];
    console.log('Sats per byte', this.satsbyte);
    let num = 0;
    for (const propScript in expectedPaymentOutputsMap) {
      if (!expectedPaymentOutputsMap.hasOwnProperty(propScript)) {
        continue;
      }
      const outputValue = expectedPaymentOutputsMap[propScript]['v']
      const outputArc20 = expectedPaymentOutputsMap[propScript]['id']
      const expectedAddress = detectScriptToAddressType(propScript);
      paymentOutputs.push({
        address: expectedAddress,
        value: outputValue
      });
      console.log('Output #' + num);
  
      if (outputArc20) {
        console.log('Price: ', outputValue / 100000000, `ARC20: (${outputArc20})`);
      } else {
        console.log('Price: ', outputValue / 100000000);
      }
      
      if (outputArc20) {
        console.log(`WARNING: You must send ARC20: (${outputArc20}) for this output`);
      }
      console.log('Payment Address:', expectedAddress);
      num++;
    }

    const paymentResult = await this.makePayment(selection['atomical_id'], paymentOutputs, keypairFunding, this.satsbyte);
    return {
      success: true,
      data: paymentResult
    }
  }

  hasSubrealmsAwaitingPayment(statusReturn): boolean {
    return statusReturn['request_subrealm'] && statusReturn['request_subrealm']['pending_awaiting_payment'];
  }

  hasSubrealmsAwaitingPaymentWindow(statusReturn): boolean {
    return statusReturn['request_subrealm'] && statusReturn['request_subrealm']['pending_awaiting_confirmations_for_payment_window'];
  }

  calculateFundsRequired(price, satsbyte): number {
    const base = 300 * (satsbyte ? satsbyte : 1)
    return base + price;
  }

  async makePayment(atomicalId: string, paymentOutputs: Array<{ address: string, value: number }>, fundingKeypair: any, satsbyte: number) {
    const keypairFundingInfo: KeyPairInfo = getKeypairInfo(fundingKeypair)
    console.log('Funding address of the funding private key (WIF) provided: ', keypairFundingInfo.address);
    logBanner('Preparing Funding Fees...');
    let price = 0;
    paymentOutputs.map((e) => {
      price += e.value;
    });
    console.log('paymentOutputs', paymentOutputs);
    const expectedSatoshisDeposit = this.calculateFundsRequired(price, satsbyte);
    const psbt = new bitcoin.Psbt({ network: NETWORK })
    logBanner(`DEPOSIT ${expectedSatoshisDeposit / 100000000} BTC to ${keypairFundingInfo.address}`);
    qrcode.generate(keypairFundingInfo.address, { small: false });
    console.log(`...`)
    console.log(`...`)
    console.log(`WAITING UNTIL ${expectedSatoshisDeposit / 100000000} BTC RECEIVED AT ${keypairFundingInfo.address}`)
    console.log(`...`)
    console.log(`...`)
    let utxo = await this.electrumApi.waitUntilUTXO(keypairFundingInfo.address, expectedSatoshisDeposit, 5, true);
    console.log(`Detected UTXO (${utxo.txid}:${utxo.vout}) with value ${utxo.value} for funding the operation...`);
    // Add the funding input
    psbt.addInput({
      sequence: this.options.rbf ? RBF_INPUT_SEQUENCE : undefined,
      hash: utxo.txid,
      index: utxo.outputIndex,
      witnessUtxo: { value: utxo.value, script: keypairFundingInfo.output },
      tapInternalKey: keypairFundingInfo.childNodeXOnlyPubkey,
    });

    for (const paymentOutput of paymentOutputs) {
      psbt.addOutput({
        value: paymentOutput.value,
        address: paymentOutput.address,
      })
    }
  
    const outpoint = compactIdToOutpoint(atomicalId);
    const atomEnvBuf = Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, 'utf8');
    const payOpBuf = Buffer.from('p', 'utf8');
    const outpointBuf = Buffer.from(outpoint, 'hex')
    const embed = bitcoin.payments.embed({ data: [atomEnvBuf, payOpBuf, outpointBuf] });
    const paymentRecieptOpReturn = embed.output!

    psbt.addOutput({
      script: paymentRecieptOpReturn,
      value: 0,
    })
    // Add op return here
    psbt.signInput(0, keypairFundingInfo.tweakedChildNode)
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawtx = tx.toHex();
    console.log('rawtx', rawtx);
    console.log(`Constructed Atomicals Payment, attempting to broadcast: ${tx.getId()}`);
    console.log(`About to broadcast`);
    let broadcastedTxId = await this.electrumApi.broadcast(rawtx);
    console.log(`Success!`);
    return broadcastedTxId;
  }

  makePrettyMenu(statusReturn) {
    console.log(chalk.blue.bold('GENERAL INFORMATION'));
    console.log(chalk.blue.bold('------------------------------------------------------'));
    console.log('Current Block Height: ', chalk.bold(statusReturn.current_block_height));
    console.log('\n')
    console.log(chalk.blue.bold('PENDING AWAITING PAYMENT'));
    console.log(chalk.blue.bold('------------------------------------------------------'));

    let counter = 0;
    if (!this.hasSubrealmsAwaitingPayment(statusReturn)) {
      console.log('There are no subrealms awaiting payment at the moment. Any pending awaiting payments will appear here during their payment windows.');
      console.log('\n')
    } else {
      for (const subrealm_pending of statusReturn['request_subrealm']['pending_awaiting_payment']) {
        console.log(chalk.bold(counter + '. Subrealm Request: +' + subrealm_pending['request_full_realm_name']))
        console.log('Atomical Id: ' + subrealm_pending['atomical_id'])
        console.log('Atomical Number: ' + subrealm_pending['atomical_number'])
        console.log('Status: ', subrealm_pending['status']['status'])
        const make_payment_from_height = subrealm_pending['make_payment_from_height'];
        const payment_due_no_later_than_height = subrealm_pending['payment_due_no_later_than_height'];
        console.log(`make_payment_from_height: ` + chalk.bold(`${make_payment_from_height}`));
        console.log(`payment_due_no_later_than_height: ` + chalk.bold(`${payment_due_no_later_than_height}`));
        const expectedPaymentOutputs = subrealm_pending['applicable_rule']['matched_rule']['o'];
        let i = 0;
        for (const propScript in expectedPaymentOutputs) {
          if (!expectedPaymentOutputs.hasOwnProperty(propScript)) {
            continue;
          }
          const expectedOutputScript = propScript;
          const expectedAddress = detectScriptToAddressType(expectedOutputScript);
          console.log('Expected Payment Outputs For Rule: ');
          //const applicableRulePrice = expectedPaymentOutputs[propScript];
          const outputValue = expectedPaymentOutputs[propScript]['v']
          const outputArc20 = expectedPaymentOutputs[propScript]['id']
          const price = outputValue / 100000000;
          if (outputArc20) {
            console.log(`Payment output #${i} to address ${expectedAddress} for amount ${price} in ARC20: ${outputArc20}`);
          } else {
            console.log(`Payment output #${i} to address ${expectedAddress} for amount ${price}`);
          }
        
          i++;
        }
        const outpoint = compactIdToOutpoint(subrealm_pending['atomical_id']);
        const atomEnvBuf = Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, 'utf8');
        const payOpBuf = Buffer.from('p', 'utf8');
        const outpointBuf = Buffer.from(outpoint, 'hex')
        const embed = bitcoin.payments.embed({ data: [atomEnvBuf, payOpBuf, outpointBuf] });
        const paymentReceipt = embed.output!
        console.log(`Payment receipt (OP_RETURN): ` + chalk.bold(`${paymentReceipt.toString('hex')}`));
        console.log(chalk.red.bold(`ACTION REQUIRED: Make payment outputs before block height ${payment_due_no_later_than_height}`));
        console.log(chalk.red.bold(`WARNING: If the payment is not made by block ${payment_due_no_later_than_height} then someone else could claim this subrealm and your request will expire.`));
        console.log('\n')
        counter++;
      }
    }
  
    console.log(chalk.blue.bold('PENDING AWAITING CONFIRMATIONS FOR PAYMENT WINDOW'));
    console.log(chalk.blue.bold('------------------------------------------------------'));
  
    if (!this.hasSubrealmsAwaitingPaymentWindow(statusReturn)) {
      console.log('There are no subrealms awaiting confirmations for the payment window. Go ahead and mint a subrealm first.');
      console.log('\n')
    } else {
      for (const subrealm_pending of statusReturn['request_subrealm']['pending_awaiting_confirmations_for_payment_window']) {
        console.log(chalk.bold('Pending Subrealm Request: +' + subrealm_pending['request_full_realm_name']))
        console.log('Atomical Id: ' + subrealm_pending['atomical_id'])
        console.log('Atomical Number: ' + subrealm_pending['atomical_number'])
        console.log('Status: ', subrealm_pending['status']['status'])
        const make_payment_from_height = subrealm_pending['make_payment_from_height'];
        const payment_due_no_later_than_height = subrealm_pending['payment_due_no_later_than_height'];
        console.log(`make_payment_from_height: ` + chalk.bold(`${make_payment_from_height}`));
        console.log(`payment_due_no_later_than_height: ` + chalk.bold(`${payment_due_no_later_than_height}`));
        const applicableRulePrice = subrealm_pending['applicable_rule']['matched_rule']['satoshis']
        const price = applicableRulePrice / 100000000;
        console.log(chalk.green.bold(`NO ACTION REQUIRED YET. Wait until block height ${make_payment_from_height} for the payment window to open. The price will be ${price} if your request is the leading candidate.`));
        console.log(`WARNING: If a payment is made prematurely ${payment_due_no_later_than_height} then your funds would be lost if someone had an earlier commit and reveals it before block height ${make_payment_from_height}`);
        console.log('------------------------------------------------------')
      }
    }
    console.log(chalk.blue.bold('OTHER PENDING STATES'));
    console.log(chalk.blue.bold('------------------------------------------------------'));
    let foundOther = false;
    for (const prop in statusReturn['request_subrealm']) {
      if (!statusReturn['request_subrealm'].hasOwnProperty(prop)) {
        continue;
      }
      if (prop === 'pending_awaiting_payment' || prop === 'pending_awaiting_confirmations_for_payment_window') {
        continue;
      }
      foundOther = true
      const subrealm_pendings_list = statusReturn['request_subrealm'][prop]
      for (const subrealm_pending of subrealm_pendings_list) {
        console.log(chalk.bold('Pending: +' + subrealm_pending['request_full_realm_name']))
        console.log('Atomical Id: ' + subrealm_pending['atomical_id'])
        console.log('Atomical Number: ' + subrealm_pending['atomical_number'])
        console.log('Status: ', subrealm_pending['status']['status'])
        console.log(`NO ACTION REQUIRED`);
        console.log('------------------------------------------------------')
      }
    }
    if (!foundOther) {
      console.log('There are no subrealms in other pending states');
      console.log('\n')
    }  
  }

  async promptSubrealmSelection(pendingSubrealms): Promise<{ atomicalId: string, value: number } | any> {
    if (!pendingSubrealms || !pendingSubrealms.length) {
      return null;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      let reply: string = '';
      const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));
      while (reply !== 'q') {
        console.log(`Specify the number of the subrealm above to make a payment for or 'q' to quit.`)
        console.log('-')
        reply = (await prompt("Enter your selection: ") as any);
        switch (reply) {
          case 'q':
            throw new Error('User cancelled')
          default:
            const parsedNum = parseInt(reply, 10);
            if (parsedNum >= pendingSubrealms.length || parsedNum < 0) {
              console.log('Invalid selection.');
              continue;
            }
            return pendingSubrealms[parsedNum];
        }
      }
      return null
    } finally {
      rl.close();
    }
  }


}