import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
export class GetAtomicalsAddressCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private address: string,
  ) {
  }
  async run(): Promise<any> {
    const { scripthash }  = detectAddressTypeToScripthash(this.address)
    const result = await this.electrumApi.atomicalsByScripthash(scripthash);
    return result;
  }
}