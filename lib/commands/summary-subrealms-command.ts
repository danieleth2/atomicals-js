import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";

export interface SummarySubrealmsCommandResultInterface {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

export interface SubrealmSummaryItemInterface {
  atomical_id: string;
  atomical_number: number;
  request_full_realm_name: string;
  full_realm_name?: string;
  status: string;
}
export interface SubrealmSummaryItemMapInterface {
  [key: string]: SubrealmSummaryItemInterface | any;
}
 
export class SummarySubrealmsCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private address: string,
    private filter?: string
  ) {
  }

  async run(): Promise<any> {
    const { scripthash } = detectAddressTypeToScripthash(this.address);
    let res = await this.electrumApi.atomicalsByScripthash(scripthash, true);
    const statusMap: SubrealmSummaryItemMapInterface = {}

    for (const prop in res.atomicals) {
      if (!res.atomicals.hasOwnProperty(prop)) {
        continue;
      }
      const entry = res.atomicals[prop];
      if (entry.type !== 'NFT') {
        continue;
      }
      if (!entry.subtype || (entry.subtype !== 'subrealm' && entry.subtype !== 'request_subrealm')) {
        continue;
      }
      const entryStatus = entry['request_subrealm_status']['status'];

      if (this.filter) {
        const myRe = new RegExp(this.filter);
        if (!myRe.test(entryStatus)) {
          continue;
        }
      }
      
      statusMap[entry.subtype] = statusMap[entry.subtype] || {}
      statusMap[entry.subtype][entryStatus] = statusMap[entry.subtype][entryStatus] || []
      statusMap[entry.subtype][entryStatus].push({
        atomical_id: entry['atomical_id'],
        atomical_number: entry['atomical_number'],
        full_realm_name: entry['full_realm_name'],
        request_full_realm_name: entry['request_full_realm_name'],
        status: entry['request_subrealm_status']
      })
    }
    return {
      success: true,
      data: {
        ...statusMap,
      }
    }
  }
}