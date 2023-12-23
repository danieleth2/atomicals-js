import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";

export interface SummaryContainersCommandResultInterface {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

export interface ContainersSummaryItemInterface {
  atomical_id: string;
  atomical_number: number;
  request_full_realm_name: string;
  full_realm_name?: string;
  status: string;
}
export interface ContainersSummaryItemMapInterface {
  [key: string]: ContainersSummaryItemInterface | any;
}

export class SummaryContainersCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private address: string,
    private filter?: string
  ) {
  }

  async run(): Promise<any> {
    const { scripthash } = detectAddressTypeToScripthash(this.address);
    let res = await this.electrumApi.atomicalsByScripthash(scripthash, true);
    const statusMap: ContainersSummaryItemMapInterface = {}

    for (const prop in res.atomicals) {
      if (!res.atomicals.hasOwnProperty(prop)) {
        continue;
      }
      const entry = res.atomicals[prop];
      if (entry.type !== 'NFT') {
        continue;
      }
      if (!entry.subtype || (entry.subtype !== 'container' && entry.subtype !== 'request_container')) {
        continue;
      }

      const entryStatus = entry['request_container_status']['status'];

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
        request_container: entry['request_container'],
        status: entry['request_container_status']
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