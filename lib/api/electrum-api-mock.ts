import { ElectrumApiInterface } from "./electrum-api.interface";

export class ElectrumApiMock implements ElectrumApiInterface {
    private sendTransactionCallback: Function | undefined;
    private getUnspentAddressCallBack: Function | undefined;
    private getUnspentScripthashCallBack: Function | undefined;
    private getTxCallback: Function | undefined;
    private isOpenFlag = false;
    constructor() { }

    async close() {
        this.isOpenFlag = false;
    }

    async open() {
        this.isOpenFlag = true;
    }

    isOpen() {
        return this.isOpenFlag;
    }

    async dump() {
 
    }

    async resetConnection() {
        await this.open();
    }

    async atomicalsGetGlobal(hashes: number) {
       return null;
    }

    

    setSendTransaction(cb: Function) {
        return this.sendTransactionCallback = cb;
    }

    async sendTransaction(rawtx: string): Promise<string> {
        if (!this.sendTransactionCallback) {
            throw "sendTransactionCallback undefined";
        }
        return this.sendTransactionCallback(rawtx);
    }

    setGetUnspentAddress(cb: Function) {
        return this.getUnspentAddressCallBack = cb;
    }

    async getUnspentAddress(address: string): Promise<any> {
        if (!this.getUnspentAddressCallBack) {
            throw "getUnspentAddressCallBack undefined";
        }
        return this.getUnspentAddressCallBack(address);
    }

    setGetUnspentScripthash(cb: Function) {
        return this.getUnspentScripthashCallBack = cb;
    }

    async getUnspentScripthash(scripthash: string): Promise<any> {
        if (!this.getUnspentScripthashCallBack) {
            throw "getUnspentScripthashCallBack undefined";
        }
        return this.getUnspentScripthashCallBack(scripthash);
    }

    setGetTx(cb: Function) {
        return this.getTxCallback = cb;
    }

    async getTx(txid: string, verbose = false): Promise<any> {
        if (!this.getTxCallback) {
            throw "getTxCallback undefined";
        }
        return this.getTxCallback(txid);
    }

    async waitUntilUTXO(address: string, satoshis: number, intervalSeconds = 10): Promise<any> {
        return new Promise<any[]>((resolve, reject) => {
            let intervalId: any;
            const checkForUtxo = async () => {
                try {
                    const response: any = await this.getUnspentAddress(address);
                    const utxos = response.utxos;

                    for (const utxo of utxos) {
                        console.log('utxo', utxo);
                        if (utxo.value >= satoshis) {
                            return utxo;
                        }
                    }

                } catch (error) {
                    reject(error);
                    clearInterval(intervalId);
                }
            };
            intervalId = setInterval(checkForUtxo, intervalSeconds * 1000);
        });
    }
    public async serverVersion(): Promise<any> {
        return "test mock"
    }
    public async broadcast(rawtx: string, force?: boolean): Promise<any> {
        return "send"
    }
    public async history(scripthash: string): Promise<any> {
        return "history"
    }
    public async atomicalsGet(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGet"
    }
    public async atomicalsGetFtInfo(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetFtInfo"
    }
    
    public async atomicalsGetLocation(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetLocation"
    }
    public async atomicalsGetState(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetState"
    }
    public async atomicalsGetStateHistory(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetStateHistory"
    }
    public async atomicalsGetEventHistory(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetEventHistory"
    }
    public async atomicalsGetTxHistory(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetTxHistory"
    }
    public async atomicalsList(limit: number, offset: number, asc: boolean): Promise<any> {
        return "atomicalsList"
    }
    public async atomicalsByScripthash(scripthash: string, verbose = true): Promise<any> {
        return "atomicalsByScripthash"
    }
    public async atomicalsByAddress(address: string): Promise<any> {
        return "atomicalsByAddress"
    }
    public async atomicalsAtLocation(location: string): Promise<any> {
        return "atomicalsAtLocation"
    }
    public async atomicalsGetMintData(atomicalAliasOrId: string | number): Promise<any> {
        return "atomicalsGetMintData"
    }
    public async atomicalsGetByRealm(realm: string): Promise<any> {
        return "atomicalsGetByRealm"
    }
    public async atomicalsGetRealmInfo(realmOrSubRealm: string, verbose?: boolean): Promise<any> {
        return "atomicalsGetRealmInfo"
    }
    public async atomicalsGetByTicker(ticker: string): Promise<any> {
        return "atomicalsGetByTicker"
    }
    public async atomicalsGetByContainer(container: string): Promise<any> {
        return "atomicalsGetByContainer"
    }
    public async atomicalsGetContainerItems(container: string, limit: number, offset: number): Promise<any> {
        return "atomicalsGetContainerItems"
    }
    public async atomicalsGetByContainerItem(container: string, item: string): Promise<any> {
        return "atomicalsGetByContainerItem"
    }
    public async atomicalsGetByContainerItemValidated(container: string, item: string, bitworkc: string, bitworkr: string, main: string, mainHash: string, proof: any, checkWithoutSealed: boolean): Promise<any> {
        return "atomicalsGetByContainerItemValidated"
    }
    
    public async atomicalsFindTickers(tickerPrefix: string | null, asc?: boolean): Promise<any> {
        return "atomicalsFindTickers"
    }
    public async atomicalsFindContainers(containerPrefix: string | null, asc?: boolean): Promise<any> {
        return "atomicalsFindContainers"
    }
    public async atomicalsFindRealms(realmPrefix: string | null, asc?: boolean): Promise<any> {
        return "atomicalsFindRealms"
    }
    public async atomicalsFindSubRealms(parentRealmId: string, subrealmPrefix: string | null, asc?: boolean): Promise<any> {
        return "atomicalsFindSubRealms"
    }
}

