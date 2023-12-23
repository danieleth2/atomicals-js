import { CommandResultInterface } from "../commands/command-result.interface";
import { AtomicalsGetFetchType } from "../commands/command.interface";
import { GetSubrealmInfoCommandResultInterface } from "../commands/get-subrealm-info-command";
import { IValidatedWalletInfo, IWalletRecord } from "../utils/validate-wallet-storage";

export interface BaseRequestOptions {
    rbf?: boolean;
    meta?: string[] | any;
    ctx?: string[] | any;
    init?: string[] | any;
    satsbyte?: number;
    satsoutput?: number;
    container?: string;
    bitworkc?: string;
    bitworkr?: string;
    parent?: string;
    parentOwner?: IWalletRecord;
    disableMiningChalk?: boolean;
    disableautoencode?: boolean;
}

export const BASE_REQUEST_OPTS_DEFAULTS = {
    satsbyte: 10,
    satsoutput: 1000,
    rbf: false,
}

export interface APIInterface {
    // Mint non-fungible-token methods (NFT)
    mintNftInteractive(options: BaseRequestOptions, files: string[], address: string, WIF: string): Promise<CommandResultInterface>;
    mintRealmInteractive(options: BaseRequestOptions, requestRealm: string, address: string, WIF: string): Promise<CommandResultInterface>;
    mintSubrealmInteractive(options: BaseRequestOptions, requestSubRealm: string, address: string, WIF: string, owner: IWalletRecord): Promise<CommandResultInterface>;
    mintContainerInteractive(options: BaseRequestOptions, requestContainer: string, address: string, WIF: string): Promise<CommandResultInterface>;
    mintContainerItemInteractive(options: BaseRequestOptions, container: string, itemId: string, manifestFile: string, address: string, WIF: string, owner: IWalletRecord): Promise<CommandResultInterface>;

    // Mint fungible-token methods (FT)
    mintFtInteractive(options: BaseRequestOptions, file: string, supply: number, address: string, requestTicker: string, WIF: string): Promise<CommandResultInterface>;
    mintDftInteractive(options: BaseRequestOptions, address: string, ticker: string, WIF: string): Promise<CommandResultInterface>;
    initDftInteractive(options: BaseRequestOptions, file: string, address: string, requestTicker: string, mintAmount: number, maxMints: number, mintHeight: number, mintBitworkc: string, mintBitworkr: string, WIF: string): Promise<CommandResultInterface>;

    // Create data transaction (Non-Atomical/Non-Token)
    mintDatInteractive(options: BaseRequestOptions, filepath: string, givenFileName: string, address: string, WIF: string): Promise<CommandResultInterface>;

    // Modify methods
    enableSubrealmRules(options: BaseRequestOptions, realmOrSubrealm: string, file: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    disableSubrealmRules(options: BaseRequestOptions, realmOrSubrealm: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    setInteractive(options: BaseRequestOptions, atomicalId: string, jsonFilename: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    deleteInteractive(options: BaseRequestOptions, atomicalId: string, keysToDelete: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    sealInteractive(options: BaseRequestOptions, atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    splatInteractive(options: BaseRequestOptions, atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    splitItneractive(options: BaseRequestOptions, atomicalId: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;
    setContainerDmintInteractive(options: BaseRequestOptions, containerName: string, jsonFile: string, funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;

    // Transfer methods
    transferInteractiveNft(options: BaseRequestOptions, atomicalId: string, owner: IWalletRecord, funding: IWalletRecord, receiveAddress: string, satsbyte: number, satsoutput: number): Promise<CommandResultInterface>;
    transferInteractiveFt(options: BaseRequestOptions, atomicalId: string, owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number, nofunding: boolean, atomicalIdReceipt?: string): Promise<CommandResultInterface>;
    transferInteractiveUtxos(options: BaseRequestOptions, owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number, nofunding: boolean, atomicalIdReceipt?: string): Promise<CommandResultInterface>;
    transferInteractiveBuilder(options: BaseRequestOptions, owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number, nofunding: boolean, atomicalIdReceipt?: string, atomicalIdReceiptType?: string, forceSkipValidation?: boolean): Promise<CommandResultInterface>;
    mergeInteractiveUtxos(options: BaseRequestOptions, owner: IWalletRecord, funding: IWalletRecord, validatedWalletInfo: IValidatedWalletInfo, satsbyte: number): Promise<CommandResultInterface>;

    // Summaries of specific types of tokens such as: Realm, Container, and Tickers
    summarySubrealms(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    summaryContainers(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    summaryRealms(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    summaryTickers(address: string, filter: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    pendingSubrealms(options: BaseRequestOptions, address: string, funding: IWalletRecord, satsbyte: number, display: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;

    // Set/delete relationships such as container membership
    setRelationInteractive(options: BaseRequestOptions, atomicalId: string, relationName, values: string[], funding: IWalletRecord, atomicalOwner: IWalletRecord): Promise<CommandResultInterface>;

    // Query and search
    getAtomicalFtInfo(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomical(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalLocation(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalHistory(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalState(atomicalId: string, verbose: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalStateHistory(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalEventHistory(atomicalId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    searchTickers(prefix: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    searchRealms(prefix: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    searchContainers(prefix: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByRealm(realm: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByTicker(ticker: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByContainerItem(container: string, itemId: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getAtomicalByContainerItemValidated(container: string, itemId: string,  manifestFile: string, address: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;

    resolveAtomical(atomicalIdOrNumberOrVariousName: string, atomicalsGetFetchType: AtomicalsGetFetchType, verbose: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    getRealmInfo(atomicalIdOrNumberOrVariousName: string, verbose: boolean, keepElectrumAlive: boolean): Promise<GetSubrealmInfoCommandResultInterface>;
    list(offset: number, limit: number, asc: boolean, verbose: boolean): Promise<CommandResultInterface>;
    getAtomicals(address: string): Promise<CommandResultInterface>;
    getAtomicalsAtLocation(address: string): Promise<CommandResultInterface>;
    getUtxos(address: string, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    broadcast(rawtx: string): Promise<CommandResultInterface>;
    download(locationIdOrTxId: string, name: string): Promise<CommandResultInterface>;
    walletInfo(address: string, verbose: boolean, keepElectrumAlive: boolean): Promise<CommandResultInterface>;
    serverVersion(): Promise<CommandResultInterface>;
}
