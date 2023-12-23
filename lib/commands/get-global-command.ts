import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { decorateAtomical } from "../utils/atomical-format-helpers";
import { CommandInterface } from "./command.interface";

export class GetGlobalCommand implements CommandInterface {
  constructor( private electrumApi: ElectrumApiInterface, private hashes: number) {
  }

  async run(): Promise<any> {
    let response = await this.electrumApi.atomicalsGetGlobal(this.hashes);
    const updatedRes = Object.assign({},
      response,
      {
        result: decorateAtomical(response.result)
      }
    );
    return {
      success: true,
      data: updatedRes
    }
  }
}