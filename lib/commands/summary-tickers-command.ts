import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";

export interface SummaryTickersCommandResultInterface {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

export interface TickersSummaryItemInterface {
  atomical_id: string;
  atomical_number: number;
  ticker?: string;
  status: string;
}
export interface TickersSummaryItemMapInterface {
  [key: string]: TickersSummaryItemInterface | any;
}
 
export class SummaryTickersCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private address: string,
    private filter?: string
  ) {
  }

  async run(): Promise<any> {
    const { scripthash } = detectAddressTypeToScripthash(this.address);
    let res = await this.electrumApi.atomicalsByScripthash(scripthash, true);
    const statusMap: TickersSummaryItemMapInterface = {}

    for (const prop in res.atomicals) {
      if (!res.atomicals.hasOwnProperty(prop)) {
        continue;
      }
      const entry = res.atomicals[prop];
      if (entry.type !== 'FT') {
        continue;
      }
      if (!entry['request_ticker_status']) {
        continue;
      }
 
      const entryStatus = entry['request_ticker_status']['status'];

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
        ticker: entry['ticker'],
        confirmed: entry['confirmed'],
        status: entry['request_ticker_status'],
        request_ticker: entry['request_ticker'],
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