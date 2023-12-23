import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { decorateAtomicals } from "../utils/atomical-format-helpers";
export class ListCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private limit: number,
    private offset: number,
    private asc: boolean
  ) {
  }
  async run(): Promise<any> {
    const response = await this.electrumApi.atomicalsList(this.limit, this.offset, this.asc);
    return Object.assign({},
      response,
      {
        success: true,
        data: {
          global: response.global,
          result: decorateAtomicals(response.result),
        }
      }
    );
  }
}