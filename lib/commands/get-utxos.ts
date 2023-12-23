import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";

export class GetUtxosCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private address: string,
  ) {
  }

  async run(): Promise<any> {
    const { scripthash }  = detectAddressTypeToScripthash(this.address);
    return this.electrumApi.getUnspentScripthash(scripthash);
  }
}