import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
 
export class GetContainerItemCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private containerName: any,
    private item: any
  ) {
  }

  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsGetByContainerItem(this.containerName, this.item);
    return {
      success: true,
      data: responseResult.result
    }

  }
}