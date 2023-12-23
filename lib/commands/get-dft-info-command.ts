import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import { decorateAtomical } from "../utils/atomical-format-helpers";
import { ResolveCommand } from "./resolve-command";

export class GetFtInfoCommand implements CommandInterface {
  constructor(private electrumApi: ElectrumApiInterface,
    private atomicalAliasOrId: string
  ) {
  }

  async run(): Promise<any> {
    const command: CommandInterface = new ResolveCommand(this.electrumApi, this.atomicalAliasOrId, AtomicalsGetFetchType.GET);
    const resolved: any = await command.run();
    let response;
    response = await this.electrumApi.atomicalsGetFtInfo(resolved.data.result.atomical_id);
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