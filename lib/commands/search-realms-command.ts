import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
export class SearchRealmsCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private prefix: string,
    private asc?: boolean,
  ) {
  }

  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsFindRealms(this.prefix, this.asc);
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