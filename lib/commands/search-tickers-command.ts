import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
export class SearchTickersCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private prefix: string | null,
    private asc?: boolean,
  ) {
  }
  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsFindTickers(this.prefix, this.asc);
    if (!responseResult.result) {
      return {
        success: false,
        data: responseResult
      }
    } else if (responseResult.result) {
      return {
        success: true,
        data: responseResult.result
      }
    }
  }
}