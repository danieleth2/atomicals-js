import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";

export class TxCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private txid: string,
    private verbose: boolean
  ) {
  }

  async run(): Promise<any> {
    return this.electrumApi.getTx(this.txid, this.verbose);
  }
}