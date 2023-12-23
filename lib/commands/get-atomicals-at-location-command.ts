import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
export class GetAtomicalsAtLocationCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private location: string,
  ) {
  }
  async run(): Promise<any> {
    return {
      success: true,
      data: await this.electrumApi.atomicalsAtLocation(this.location)
    }
  }
}