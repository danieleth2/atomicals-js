import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";

export class AddressHistoryCommand implements CommandInterface {
  constructor(  
    private electrumApi: ElectrumApiInterface,
    private address: string
  ) {
  }

  async run(): Promise<any> {
    const { scripthash }  = detectAddressTypeToScripthash(this.address);
    return {
      success: true,
      data: {
        address: this.address,
        scripthash: scripthash,
        history: await this.electrumApi.history(scripthash)
      }
    }
  }
}