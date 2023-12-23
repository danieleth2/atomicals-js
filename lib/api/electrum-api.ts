/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable prettier/prettier */
import axios, { AxiosResponse } from 'axios';
import { ElectrumApiInterface, IUnspentResponse } from "./electrum-api.interface";
import { UTXO } from "../types/UTXO.interface"
import { detectAddressTypeToScripthash } from "../utils/address-helpers"

export class ElectrumApi implements ElectrumApiInterface {
    private isOpenFlag = false;

    private constructor(private baseUrl: string, private usePost = true) {
        this.resetConnection();
    }

    public async resetConnection() {

    }

    static createClient(url: string, usePost = true) {
        return new ElectrumApi(url, usePost);
    }

    public open(): Promise<any> {
        return new Promise((resolve) => {
            if (this.isOpenFlag) {
                resolve(true);
                return;
            }
            resolve(true);
        });
    }

    public isOpen(): boolean {
        return this.isOpenFlag;
    }

    public close(): Promise<any> {
        return Promise.resolve(true);
    }

    public async call(method, params) {
        try {
            let response: AxiosResponse<any, any>;
            if (this.usePost) {
                response = await axios.post(`${this.baseUrl}/${method}`, {params});
            } else {
                response = await axios.get(`${this.baseUrl}/${method}?params=${JSON.stringify(params)}`);
            }
            return response.data.response;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }

    public sendTransaction(signedRawTx: string): Promise<any> {
        return this.broadcast(signedRawTx);
    }

    public getTx(txId: string, verbose = false): Promise<any> {
        return new Promise((resolve, reject) => {
            this.call('blockchain.transaction.get', [txId, verbose ? 1 : 0]
            ).then((result: any) => {
                resolve({success: true, tx: result});
            }).catch((error) => reject(error))
        });
    }

    public getUnspentAddress(address: string): Promise<IUnspentResponse | any> {
        const {scripthash} = detectAddressTypeToScripthash(address)
        return this.getUnspentScripthash(scripthash)
    }

    public getUnspentScripthash(scriptHash: string): Promise<IUnspentResponse | any> {
        return new Promise((resolve, reject) => {
            this.call('blockchain.scripthash.listunspent', [scriptHash]).then(function (result: any) {
                const data = {unconfirmed: 0, confirmed: 0, utxos: [] as UTXO[]};
                for (const utxo of result) {
                    if (!utxo.height || utxo.height <= 0) {
                        data.unconfirmed += utxo.value;
                    } else {
                        data.confirmed += utxo.value;
                    }
                    // data.balance += utxo.value;
                    data.utxos.push({
                        txid: utxo.tx_hash,
                        txId: utxo.tx_hash,
                        // height: utxo.height,
                        outputIndex: utxo.tx_pos,
                        index: utxo.tx_pos,
                        vout: utxo.tx_pos,
                        value: utxo.value,
                        atomicals: utxo.atomicals,
                        // script: addressToP2PKH(address)
                    })
                }
                resolve(data);
            }).catch((error) => reject(error))
        });
    }

    async waitUntilUTXO(address: string, satoshis: number, intervalSeconds = 10, exactSatoshiAmount = false): Promise<UTXO> {
        function hasAttachedAtomicals(utxo): any | null {
            if (utxo && utxo.atomicals && utxo.atomicals.length) {
                return true;
            }
            return utxo && utxo.height <= 0;
        }
        return new Promise((resolve, reject) => {
            let intervalId: any;
            const checkForUtxo = async () => {
                console.log('...');
                try {
                    const response: any = await this.getUnspentAddress(address).catch((e) => {
                        console.error(e);
                        return {unconfirmed: 0, confirmed: 0, utxos: []};
                    });
                    const utxos = response.utxos.sort((a, b) => a.value - b.value);
                    for (const utxo of utxos) {
                        // Do not use utxos that have attached atomicals
                        if (hasAttachedAtomicals(utxo)) {
                            continue;
                        }
                        // If the exact amount was requested, then only return if the exact amount is found
                        if (exactSatoshiAmount) {
                            if (utxo.value === satoshis) {
                                clearInterval(intervalId);
                                resolve(utxo);
                                return;
                            }
                        } else {
                            if (utxo.value >= satoshis) {
                                clearInterval(intervalId);
                                resolve(utxo);
                                return;
                            }
                        }
                    }

                } catch (error) {
                    console.error(error);
                    reject(error);
                    clearInterval(intervalId);
                }
            };
            intervalId = setInterval(checkForUtxo, intervalSeconds * 1000);
        });
    }

    public serverVersion(): Promise<any> {
        return this.call('server.version', []);
    }

    public broadcast(rawtx: string, force = false): Promise<any> {
        return this.call(
            force
                ? 'blockchain.transaction.broadcast_force'
                : 'blockchain.transaction.broadcast',
            [rawtx],
        );
    }

    public dump(): Promise<any> {
        return this.call('blockchain.atomicals.dump', []);
    }

    public atomicalsGetGlobal(hashes: number): Promise<any> {
        return this.call('blockchain.atomicals.get_global', [hashes]);
    }

    public atomicalsGet(atomicalAliasOrId: string | number): Promise<any> {
        return this.call('blockchain.atomicals.get', [atomicalAliasOrId]);
    }

    public atomicalsGetFtInfo(atomicalAliasOrId: string | number): Promise<any> {
        return this.call('blockchain.atomicals.get_ft_info', [atomicalAliasOrId]);
    }

    public atomicalsGetLocation(atomicalAliasOrId: string | number): Promise<any> {
        return this.call('blockchain.atomicals.get_location', [atomicalAliasOrId]);
    }

    public atomicalsGetStateHistory(atomicalAliasOrId: string | number): Promise<any> {
        return this.call('blockchain.atomicals.get_state_history', [atomicalAliasOrId]);
    }

    public atomicalsGetState(atomicalAliasOrId: string | number, verbose: boolean): Promise<any> {
        return this.call('blockchain.atomicals.get_state', [atomicalAliasOrId, verbose ? 1 : 0]);
    }

    public atomicalsGetEventHistory(atomicalAliasOrId: string | number): Promise<any> {
        return this.call('blockchain.atomicals.get_events', [atomicalAliasOrId]);
    }

    public atomicalsGetTxHistory(atomicalAliasOrId: string | number): Promise<any> {
        return this.call('blockchain.atomicals.get_tx_history', [atomicalAliasOrId]);
    }

    public history(scripthash: string): Promise<any> {
        return this.call('blockchain.scripthash.get_history', [scripthash]);
    }

    public atomicalsList(limit: number, offset: number, asc = false): Promise<any> {
        return this.call('blockchain.atomicals.list', [limit, offset, asc ? 1 : 0]);
    }

    public atomicalsByScripthash(scripthash: string, verbose = true): Promise<any> {
        const params: any[] = [scripthash];
        if (verbose) {
            params.push(true);
        }
        return this.call('blockchain.atomicals.listscripthash', params);
    }

    public atomicalsByAddress(address: string): Promise<any> {
        const { scripthash } = detectAddressTypeToScripthash(address);
        return this.atomicalsByScripthash(scripthash)
    }

    public atomicalsAtLocation(location: string): Promise<any> {
        return this.call('blockchain.atomicals.at_location', [location]);
    }

    public txs(txs: string[], verbose: boolean): Promise<any> {
        return Promise.all(
            txs.map((tx) => this.call('blockchain.transaction.get', [tx, verbose ? 1 : 0]))
        );
    }

    public atomicalsGetRealmInfo(realmOrSubRealm: string, verbose?: boolean): Promise<any> {
        return this.call('blockchain.atomicals.get_realm_info', [realmOrSubRealm, verbose ? 1 : 0]);
    }

    public atomicalsGetByRealm(realm: string): Promise<any> {
        return this.call('blockchain.atomicals.get_by_realm', [realm]);
    }

    public atomicalsGetByTicker(ticker: string): Promise<any> {
        return this.call('blockchain.atomicals.get_by_ticker', [ticker]);
    }

    public atomicalsGetByContainer(container: string): Promise<any> {
        return this.call('blockchain.atomicals.get_by_container', [container]);
    }

    public atomicalsGetContainerItems(container: string, limit: number, offset: number): Promise<any> {
        return this.call('blockchain.atomicals.get_container_items', [container, limit, offset]);
    }

    public atomicalsGetByContainerItem(container: string, itemName: string): Promise<any> {
        return this.call('blockchain.atomicals.get_by_container_item', [container, itemName]);
    }

    public atomicalsGetByContainerItemValidated(container: string, item: string, bitworkc: string, bitworkr: string, main: string, mainHash: string, proof: any, checkWithoutSealed: boolean): Promise<any> {
        return this.call(
            'blockchain.atomicals.get_by_container_item_validate',
            [container, item, bitworkc, bitworkr, main, mainHash, proof, checkWithoutSealed],
        );
    }

    public atomicalsFindTickers(prefix: string | null, asc?: boolean): Promise<any> {
        const args: any = []
        args.push(prefix ? prefix : null)
        if (!asc) {
            args.push(1)
        } else {
            args.push(0)
        }
        return this.call('blockchain.atomicals.find_tickers', args);
    }

    public atomicalsFindContainers(prefix: string | null, asc?: boolean): Promise<any> {
        const args: any = []
        args.push(prefix ? prefix : null)
        if (!asc) {
            args.push(1)
        } else {
            args.push(0)
        }
        return this.call('blockchain.atomicals.find_containers', args);
    }

    public atomicalsFindRealms(prefix: string | null, asc?: boolean): Promise<any> {
        const args: any = []
        args.push(prefix ? prefix : null)
        if (!asc) {
            args.push(1)
        } else {
            args.push(0)
        }
        return this.call('blockchain.atomicals.find_realms', args);
    }

    public atomicalsFindSubRealms(parentRealmId: string, prefix: string | null, asc?: boolean): Promise<any> {
        const args: any = []
        args.push(prefix ? prefix : null)
        if (!asc) {
            args.push(1)
        } else {
            args.push(0)
        }
        return this.call('blockchain.atomicals.find_subrealms', [parentRealmId, args]);
    }
}
