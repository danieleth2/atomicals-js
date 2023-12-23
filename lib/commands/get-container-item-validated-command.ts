import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
 
export class GetContainerItemValidatedCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private containerName: any,
    private item: any,
    private bitworkc: any,
    private bitworkr: any,
    private main: string,
    private mainHash: string,
    private proof: string,
    private checkWithoutSealed: boolean
  ) {
  }

  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsGetByContainerItemValidated(this.containerName, this.item, this.bitworkc, this.bitworkr, this.main, this.mainHash, this.proof, this.checkWithoutSealed);
    return {
      success: true,
      data: responseResult.result
    }
  }
}