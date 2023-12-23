import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";

export interface GetSubrealmInfoCommandResultInterface {
  success: boolean;
  data?: {

  };
  message?: any;
  error?: any;
}

export class GetRealmInfoCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private realmOrSubrealm: any,
    private verbose?: boolean
  ) {
  }

  async run(): Promise<any> {
    const responseResult = await this.electrumApi.atomicalsGetRealmInfo(this.realmOrSubrealm, this.verbose);
    return {
      success: true,
      data: responseResult.result
    }

  }
}