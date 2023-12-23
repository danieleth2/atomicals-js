import { CommandResultInterface } from "./command-result.interface";
import { CommandInterface } from "./command.interface";
import { createPrimaryAndFundingImportedKeyPairs } from "../utils/create-key-pair";
import { jsonFileExists, jsonFileWriter } from "../utils/file-utils";
import { walletPathResolver } from "../utils/wallet-path-resolver";
import * as fs from 'fs';

const walletPath = walletPathResolver();

export class WalletInitCommand implements CommandInterface {
    constructor(private phrase: string | undefined, private path: string, private n?: number) {

    }
    async run(): Promise<CommandResultInterface> {
        if (await this.walletExists()) {
            throw "wallet.json exists, please remove it first to initialize another wallet. You may also use 'wallet-create' command to generate a new wallet."
        }

        const { wallet, imported } = await createPrimaryAndFundingImportedKeyPairs(this.phrase, this.path, this.n);
        const walletDir = `wallets/`;
        if (!fs.existsSync(walletDir)) {
          fs.mkdirSync(walletDir);
        }
        const created = {
            phrase: wallet.phrase,
            primary: {
                address: wallet.primary.address,
                path: wallet.primary.path,
                WIF: wallet.primary.WIF
            },
            funding: {
                address: wallet.funding.address,
                path: wallet.funding.path,
                WIF: wallet.funding.WIF
            },
            imported
        };
        await jsonFileWriter(walletPath, created);
        return {
            success: true,
            data: created
        }
    }
    async walletExists() {
        if (await jsonFileExists(walletPath)) {
            return true;
        }
    }
}
