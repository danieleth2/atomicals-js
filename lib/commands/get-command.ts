import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { AtomicalsGetFetchType, CommandInterface } from "./command.interface";
import { decorateAtomical } from "../utils/atomical-format-helpers";

export class GetCommand implements CommandInterface {
  constructor(private electrumApi: ElectrumApiInterface,
    private atomicalAliasOrId: string,
    private fetchType: AtomicalsGetFetchType = AtomicalsGetFetchType.GET,
    private verbose?: boolean
  ) {
  }

  async run(): Promise<any> {
    let response;
    if (this.fetchType === AtomicalsGetFetchType.GET) {
      response = await this.electrumApi.atomicalsGet(this.atomicalAliasOrId);
    } else if (this.fetchType === AtomicalsGetFetchType.LOCATION) {
      response = await this.electrumApi.atomicalsGetLocation(this.atomicalAliasOrId);
    } else if (this.fetchType === AtomicalsGetFetchType.STATE) {
      response = await this.electrumApi.atomicalsGetState(this.atomicalAliasOrId, this.verbose || false);
    } else if (this.fetchType === AtomicalsGetFetchType.STATE_HISTORY) {
      response = await this.electrumApi.atomicalsGetStateHistory(this.atomicalAliasOrId);
    } else if (this.fetchType === AtomicalsGetFetchType.EVENT_HISTORY) {
      response = await this.electrumApi.atomicalsGetEventHistory(this.atomicalAliasOrId);
    } else if (this.fetchType === AtomicalsGetFetchType.TX_HISTORY) {
      response = await this.electrumApi.atomicalsGetTxHistory(this.atomicalAliasOrId);
    } else {
      throw new Error('Invalid AtomicalsGetFetchType');
    }
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