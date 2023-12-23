import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
export class SearchContainersCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private prefix: string,
    private asc?: boolean
  ) {
  }
  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsFindContainers(this.prefix, this.asc);
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