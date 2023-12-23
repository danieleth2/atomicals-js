import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
 
export class BroadcastCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private rawtx: string,
  ) {
  }
  async run(): Promise<any> {
    const result = await this.electrumApi.broadcast(this.rawtx);
    return {
      success: true,
      data: result,
    };
  }
}
