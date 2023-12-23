import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
export class AddressInfoCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private address: string,
    private verbose: boolean
  ) {
  }

  async run(): Promise<any> {
    const { scripthash } = detectAddressTypeToScripthash(this.address);
    const balanceInfo = await this.electrumApi.getUnspentScripthash(scripthash);
    const res = await this.electrumApi.atomicalsByScripthash(scripthash);

    let history = undefined;
    if (this.verbose) {
      history = await this.electrumApi.history(scripthash);
    }

    // Filter out the utxos that contain atomicals for display the atomicals section
    const filteredAtomicalsUtxos: any = [];
    const nonAtomicalsBalanceInfoUtxos: any = [];
    let nonAtomicalsBalanceInfoConfirmed = 0;
    let nonAtomicalsBalanceInfoUnconfirmed = 0;
    for (const utxo of res.utxos) {
      if (utxo.atomicals && utxo.atomicals.length) {
        filteredAtomicalsUtxos.push({
          txid: utxo.txid,
          index: utxo.index,
          value: utxo.value,
          height: utxo.height,
          atomicals: utxo.atomicals,
        })
      } else if (!utxo.atomicals || !utxo.atomicals.length) {
        nonAtomicalsBalanceInfoUtxos.push({
          txid: utxo.txid,
          index: utxo.index,
          value: utxo.value,
          height: utxo.height
        })
        if (utxo.height && utxo.height > 0) {
          nonAtomicalsBalanceInfoConfirmed += utxo.value
        } else {
          nonAtomicalsBalanceInfoUnconfirmed += utxo.value
        }

      }
    }
    return {
      success: true,
      data: {
        address: this.address,
        scripthash: scripthash,
        atomicals: {
          count: Object.keys(res.atomicals).length,
          balances: res.atomicals,
          utxos: filteredAtomicalsUtxos,
        },
        globalBalanceInfo: {
          unconfirmed: balanceInfo.unconfirmed,
          confirmed: balanceInfo.confirmed,
          utxos: balanceInfo.utxos
        },
        nonAtomicalsBalanceInfo: {
          unconfirmed: nonAtomicalsBalanceInfoUnconfirmed,
          confirmed: nonAtomicalsBalanceInfoConfirmed,
          utxos: nonAtomicalsBalanceInfoUtxos
        },
        history
      }
    }
  }
}