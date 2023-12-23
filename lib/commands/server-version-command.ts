import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
export class ServerVersionCommand implements CommandInterface {
  constructor(private electrumApi: ElectrumApiInterface) {}
  async run(): Promise<any> {
    const result = await this.electrumApi.serverVersion();
    return result;
  }
}