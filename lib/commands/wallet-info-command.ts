import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";

export class WalletInfoCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private address: string,
    private verbose: boolean
  ) {
  }

  async run(): Promise<any> {
    const { scripthash } = detectAddressTypeToScripthash(this.address);
    let res = await this.electrumApi.atomicalsByScripthash(scripthash, true);
    let history = undefined;
    if (this.verbose) {
      history = await this.electrumApi.history(scripthash);
    }
    const plainUtxos: any[] = [];
    let total_confirmed = 0;
    let total_unconfirmed = 0;
    let regular_confirmed = 0;
    let regular_unconfirmed = 0;
    let atomicals_confirmed = 0;
    let atomicals_unconfirmed = 0;
    const atomicalsUtxos: any[] = [];

    for (const utxo of res.utxos) {

      if (utxo.height <= 0) {
        total_unconfirmed += utxo.value;

      } else {
        total_confirmed += utxo.value;
      }

      if (utxo.atomicals && utxo.atomicals.length) {

        if (utxo.height <= 0) {
          atomicals_unconfirmed += utxo.value;
        } else {

          atomicals_confirmed += utxo.value;
        }
        atomicalsUtxos.push(utxo);
        continue;
      }

      if (utxo.height <= 0) {
        regular_unconfirmed += utxo.value;
      } else {

        regular_confirmed += utxo.value;
      }

      plainUtxos.push(utxo);
    }


    return {
      success: true,
      data: {
        address: this.address,
        scripthash: scripthash,
        atomicals_count: Object.keys(res.atomicals).length,
        atomicals_utxos: atomicalsUtxos,
        atomicals_balances: res.atomicals,
        total_confirmed,
        total_unconfirmed,
        atomicals_confirmed,
        atomicals_unconfirmed,
        regular_confirmed,
        regular_unconfirmed,
        regular_utxos: plainUtxos,
        regular_utxo_count: plainUtxos.length,
        history
      }
    }
  }
}