import { AtomicalFileData } from "../interfaces/atomical-file-data";
import { basename } from "path";
import * as mime from 'mime-types';
import { chunkBuffer, fileReader, jsonFileReader } from "../utils/file-utils";
import * as cbor from 'borc';
import {
    networks,
    script,
    payments,
} from "bitcoinjs-lib";
import { KeyPairInfo } from "../utils/address-keypair-path";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from "../types/protocol-tags";
import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { ResolveCommand } from "./resolve-command";
import { AtomicalsGetFetchType } from "./command.interface";
import { AtomicalIdentifierType, decorateAtomical, encodeAtomicalIdToBuffer, encodeHashToBuffer, encodeIds } from "../utils/atomical-format-helpers";
import { IsAtomicalOwnedByWalletRecord } from "../utils/address-helpers";
import { IInputUtxoPartial } from "../types/UTXO.interface";
import * as dotenv from 'dotenv'
dotenv.config();

export const RBF_INPUT_SEQUENCE = 0xfffffffd;

export const NETWORK = process.env.NETWORK === 'testnet' ? networks.testnet : process.env.NETWORK == "regtest" ? networks.regtest : networks.bitcoin;

export function logBanner(text: string) {
    console.log("====================================================================")
    console.log(text)
    console.log("====================================================================")
}

export const calculateFundsRequired = (additionalInputValue: number, atomicalSats: number, satsByte: number, mintDataLength = 0, baseTxByteLength = 300) => {
    // The default base includes assumes 1 input and 1 output with room to spare
    const estimatedTxSizeBytes = baseTxByteLength + mintDataLength;
    const expectedFee = estimatedTxSizeBytes * satsByte;
    let expectedSatoshisDeposit = expectedFee + atomicalSats - additionalInputValue;
    if (expectedSatoshisDeposit > 0 && expectedSatoshisDeposit < 546) {
        expectedSatoshisDeposit = 546;
    }
    return {
        expectedSatoshisDeposit,
        expectedFee
    }
}

export const calculateFTFundsRequired = (numberOfInputs, numberOfOutputs, satsByte: number, mintDataLength = 0, baseTxByteLength = 300) => {
    // The default base includes assumes 1 input and 1 output with room to spare
    const estimatedTxSizeBytes = baseTxByteLength + mintDataLength;
    const baseInputSize = 36 + 4 + 64
    const baseOutputSize = 8 + 20 + 4;

    let expectedSatoshisDeposit = (estimatedTxSizeBytes + (numberOfInputs * baseInputSize) + (numberOfOutputs * baseOutputSize)) * satsByte;
    if (expectedSatoshisDeposit > 0 && expectedSatoshisDeposit < 546) {
        expectedSatoshisDeposit = 546;
    }
    return {
        expectedSatoshisDeposit
    }
}


export const calculateUtxoFundsRequired = (numberOfInputs, numberOfOutputs, satsByte: number, mintDataLength = 0, baseTxByteLength = 300) => {
    // The default base includes assumes 1 input and 1 output with room to spare
    const estimatedTxSizeBytes = baseTxByteLength + mintDataLength;
    const baseInputSize = 36 + 4 + 64
    const baseOutputSize = 8 + 20 + 4;

    let expectedSatoshisDeposit = (estimatedTxSizeBytes + (numberOfInputs * baseInputSize) + (numberOfOutputs * baseOutputSize)) * satsByte;
    if (expectedSatoshisDeposit > 0 && expectedSatoshisDeposit < 546) {
        expectedSatoshisDeposit = 546;
    }
    return {
        expectedSatoshisDeposit
    }
}



export const appendMintUpdateRevealScript2 = (opType: 'nft' | 'ft' | 'dft' | 'dmt' | 'sl' | 'x' | 'y' | 'mod' | 'evt', keypair: KeyPairInfo, files: AtomicalFileData[], log: boolean = true) => {
    let ops = `${keypair.childNodeXOnlyPubkey.toString('hex')} OP_CHECKSIG OP_0 OP_IF `;
    ops += `${Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, 'utf8').toString('hex')}`;
    ops += ` ${Buffer.from(opType, 'utf8').toString('hex')}`;
    const payload = {}
    for (const file of files) {
        if (file.contentType !== 'object') {
            payload[file.name] = {
                '$ct': file.contentType,
                '$b': file.data
            }
        } else if (file.contentType === 'object') {
            payload[file.name] = file.data
        }
    }
    function deepEqual(x, y) {
        const ok = Object.keys, tx = typeof x, ty = typeof y;
        return x && y && tx === 'object' && tx === ty ? (
            ok(x).length === ok(y).length &&
            ok(x).every(key => deepEqual(x[key], y[key]))
        ) : (x === y);
    }
    const cborEncoded = cbor.encode(payload);
    // Decode to do sanity check
    const cborDecoded = cbor.decode(cborEncoded);
    if (log) {
        console.log('CBOR Encoded', JSON.stringify(cborDecoded, null, 2));
    }
    if (!deepEqual(cborDecoded, payload)) {
        throw 'CBOR Decode error objects are not the same. Developer error';
    }
    const chunks = chunkBuffer(cborEncoded, 520);
    for (let chunk of chunks) {
        ops += ` ${chunk.toString('hex')}`;
    }
    ops += ` OP_ENDIF`;
    return ops;
};

export const prepareCommitRevealConfig2 = (opType: 'nft' | 'ft' | 'dft' | 'dmt' | 'sl' | 'x' | 'y' | 'mod' | 'evt', keypair: KeyPairInfo, filesData: AtomicalFileData[], log = true) => {
    const revealScript = appendMintUpdateRevealScript2(opType, keypair, filesData, log);
    const hashscript = script.fromASM(revealScript);
    const scriptTree = {
        output: hashscript,
    };
    const hash_lock_script = hashscript;
    const hashLockRedeem = {
        output: hash_lock_script,
        redeemVersion: 192,
    };
    const scriptP2TR = payments.p2tr({
        internalPubkey: keypair.childNodeXOnlyPubkey,
        scriptTree,
        network: NETWORK
    });

    const hashLockP2TR = payments.p2tr({
        internalPubkey: keypair.childNodeXOnlyPubkey,
        scriptTree,
        redeem: hashLockRedeem,
        network: NETWORK
    });
    return {
        scriptP2TR,
        hashLockP2TR
    }
}

export const prepareCommitRevealConfig = (opType: 'nft' | 'ft' | 'dft' | 'dmt' | 'sl' | 'x' | 'y' | 'mod' | 'evt' | 'dat', keypair: KeyPairInfo, atomicalsPayload: AtomicalsPayload, log = true) => {
    const revealScript = appendMintUpdateRevealScript(opType, keypair, atomicalsPayload, log);
    const hashscript = script.fromASM(revealScript);
    const scriptTree = {
        output: hashscript,
    };
    const hash_lock_script = hashscript;
    const hashLockRedeem = {
        output: hash_lock_script,
        redeemVersion: 192,
    };
    const scriptP2TR = payments.p2tr({
        internalPubkey: keypair.childNodeXOnlyPubkey,
        scriptTree,
        network: NETWORK
    });

    const hashLockP2TR = payments.p2tr({
        internalPubkey: keypair.childNodeXOnlyPubkey,
        scriptTree,
        redeem: hashLockRedeem,
        network: NETWORK
    });
    return {
        scriptP2TR,
        hashLockP2TR,
        hashscript
    }
}

export const readAsAtomicalFileData = async (file: string, alternateName?: string): Promise<AtomicalFileData> => {
    let expectedName = file;
    const rawbytes: any = await fileReader(file);
    let fileMintData: AtomicalFileData = {
        name: alternateName ? alternateName : expectedName,
        contentType: mime.contentType(basename(file)) || 'application/octet-stream',
        data: Buffer.from(rawbytes, 'utf8')
    }
    return fileMintData;
}
/**
 * 
 * Prepare file data from a file on disk, with an optional renaming of the file
 * OR...
 * field data (ie: JSON value or object)
 * 
 * Syntax:
 * 
 * Case 1: Store raw file, using the filename on disk as the field name:  file.txt
 * Result: file.txt: { ... file data embedded }
 * 
 * Case 2: Store raw file, but use an alternate field name: filerenamed.to.anything:file.txt
 * Result: filerenamed.to.anything: { ... file data embedded }
 * 
 * Case 3: Store scalar value or object, using a specified field name: "meta={\"hello"\:\"world\"}" or meta=123 or "meta=this is a text string"
 * 
 * @param files Key value array of files and names OR the field name and field data 
 * @returns 
 */
export const prepareFilesData = async (fields: string[]) => {
    const filesData: AtomicalFileData[] = [];
    for (const entry of fields) {
        if (entry.indexOf(',') === -1 && entry.indexOf('=') === -1) {
            filesData.push(await readAsAtomicalFileData(entry));
        } else if (entry.indexOf(',') !== -1) {
            const entrySplit = entry.split(',');
            const alternateName = entrySplit[0]
            filesData.push(await readAsAtomicalFileData(entrySplit[1], alternateName));
        } else if (entry.indexOf('=') !== -1) {
            const fieldName = entry.substring(0, entry.indexOf('='));
            const fieldValue = entry.substring(entry.indexOf('=') + 1);
            const parsedJson = JSON.parse(fieldValue);
            const fieldData: AtomicalFileData = {
                name: fieldName,
                contentType: 'object',
                data: parsedJson
            }
            filesData.push(fieldData);
        } else {
            throw new Error('Invalid field(s) specifications. Aborting...')
        }
    }
    return filesData;
}

export const readFileAsCompleteDataObject = async (filePath, givenFileName) => {
    const fileContents: any = await fileReader(filePath);
    return {
        [givenFileName]: fileContents
    };
}

export const prepareFilesDataAsObject = async (fields: string[], disableAutoncode = false) => {
    let fieldDataObject = {};
    for (const entry of fields) {
        if (entry.indexOf(',') === -1 && entry.indexOf('=') === -1) {
            let filename = entry;
            if (filename.charAt(0) === '@') {
                if (!filename.endsWith('.json')) {
                    throw new Error('Use of @ for direct embeds must only be used with .json file types');
                }
                filename = entry.substring(1);
                const jsonFileContents: any = await jsonFileReader(filename);
                fieldDataObject = Object.assign({}, fieldDataObject, {
                    ...jsonFileContents
                });
            } else {
                const fileInfo = await readAsAtomicalFileData(filename);
                fieldDataObject[basename(fileInfo.name)] = fileInfo.data
            }
        } else if (entry.indexOf(',') !== -1 && entry.indexOf('=') === -1) {
            const entrySplit = entry.split(',');
            const filePath = entrySplit[1];
            const alternateName = entrySplit[0]
            const isInlineJson = filePath.endsWith('.json') ? true : false;
            if (isInlineJson) {
                const jsonFileContents = await jsonFileReader(filePath);
                fieldDataObject[alternateName] = jsonFileContents;
            } else {
                const fileInfo = await readAsAtomicalFileData(entrySplit[1], alternateName);
                fieldDataObject[(fileInfo.name)] = {
                    '$ct': fileInfo.contentType,
                    '$b': fileInfo.data
                }
            }
        } else if (entry.indexOf('=') !== -1) {
            const fieldName = entry.substring(0, entry.indexOf('='));
            const fieldValue = entry.substring(entry.indexOf('=') + 1);
            try {
                const parsedJson = JSON.parse(fieldValue);
                fieldDataObject[fieldName] = parsedJson;
            } catch (err) {
                if (typeof fieldValue === 'string') {
                    try {
                        const num = Number(fieldValue);
                        if (!isNaN(num)) {
                            fieldDataObject[fieldName] = Number(fieldValue)
                        } else {
                            fieldDataObject[fieldName] = fieldValue;
                        }

                    } catch (ex) {
                        fieldDataObject[fieldName] = fieldValue
                    }
                }
            }

        } else {
            throw new Error('Invalid field(s) specifications. Aborting...')
        }
    }
    return fieldDataObject;
}

export const readJsonFileAsCompleteDataObjectEncodeAtomicalIds = async (jsonFile, autoEncode = false, autoEncodePattern?: string) => {
    if (!jsonFile.endsWith('.json')) {
        throw new Error('Filename must end in json')
    }
    const jsonFileContents: any = await jsonFileReader(jsonFile);
    if (autoEncode) {
        const updatedObject = {};
        encodeIds(jsonFileContents, updatedObject, encodeAtomicalIdToBuffer, encodeHashToBuffer, autoEncodePattern);
        return updatedObject;
    }
    return jsonFileContents;
}


export const readJsonFileAsCompleteDataObjectEncodeHash = async (jsonFile, autoEncode = false, autoEncodePattern?: string) => {
    if (!jsonFile.endsWith('.json')) {
        throw new Error('Filename must end in json')
    }
    const jsonFileContents: any = await jsonFileReader(jsonFile);
    if (autoEncode) {
        const updatedObject = {};
        encodeIds(jsonFileContents, updatedObject, encodeAtomicalIdToBuffer, encodeHashToBuffer, autoEncodePattern);
        return updatedObject;
    }
    return jsonFileContents;
}

export const prepareFilesDataBackup = async (files: string[], names: string[]) => {
    let fileCount = 0;
    const nameMap = {
    };

    const filesData: AtomicalFileData[] = [];
    for (const file of files) {
        let expectedName = file;
        let mimeTypeHint;
        if (names.length) {
            if (names.length !== files.length) {
                throw 'Error names argument length must match the number of files provided';
            }
            const splitted = names[fileCount].split(',');
            expectedName = splitted[0];
            mimeTypeHint = splitted[1] && splitted[1] === 'object' ? 'object' : null;
        }
        if (nameMap[expectedName]) {
            throw `Error invalid name ${expectedName} for --names. Check there are no duplicates and that '_' is also not used`;
        }
        nameMap[expectedName] = true;
        const fileIndex = fileCount + 1;
        const rawbytes: any = await fileReader(file);
        let fileMintData: AtomicalFileData = {
            name: expectedName,
            contentType: mime.contentType(file) || 'application/octet-stream',
            data: Buffer.from(rawbytes, 'utf8')
        };
        if (mimeTypeHint === 'object') {
            const rawbytes: any = await fileReader(file);
            const parsedJson = JSON.parse(rawbytes);
            fileMintData = {
                name: expectedName,
                contentType: 'object',
                data: parsedJson
            }
        }
        filesData.push(fileMintData);
        console.log(`File #${fileIndex} name locally`, file);
        console.log(`File #${fileIndex} field name:`, expectedName);
        console.log(`File #${fileIndex} size:`, rawbytes.length);
        console.log(`File #${fileIndex} content type:`, fileMintData.contentType);
        console.log('-------')
        fileCount++;
    }
    console.log("Total number of files to be added in transaction:", files.length);
    return filesData;
}

export const prepareObjectfield = async (filesData: AtomicalFileData[], objectToAdd) => {

    for (const prop in objectToAdd) {
        if (!objectToAdd.hasOwnProperty(prop)) {
            continue;
        }
        filesData.push({
            name: prop,
            contentType: 'object',
            data: isNaN(objectToAdd[prop]) ? objectToAdd[prop] : Number(objectToAdd[prop])
        })
    }

    return filesData;
}

export const prepareArgsMetaCtx = async (args: any = undefined, meta: any = undefined, ctx: any = undefined, log = true) => {
    if (log) {
        console.log('Args', args)
        console.log('Meta', meta)
        console.log('Ctx', ctx)
    }
    const filesData: AtomicalFileData[] = [];
    if (args) {
        filesData.push({
            name: 'args',
            contentType: 'object',
            data: args
        })
    }
    if (meta) {
        filesData.push({
            name: 'meta',
            contentType: 'object',
            data: meta
        })
    }
    if (ctx) {
        filesData.push({
            name: 'ctx',
            contentType: 'object',
            data: ctx
        })
    }
    return filesData;
}

export const encodeFiles = (files: AtomicalFileData[]): any => {
    const payload = {}
    for (const file of files) {
        if (file.contentType !== 'object') {
            payload[file.name] = {
                '$ct': file.contentType,
                '$d': file.data
            }
        } else if (file.contentType === 'object') {
            payload[file.name] = file.data
        }
    }
    return payload;
}


/**
 * Ensure provided object is restricted to the set of allowable datatypes to be CBOR atomicals friendly.
 * 
 */
export class AtomicalsPayload {
    private cborEncoded;
    constructor(private originalData: any) {

        if (!originalData) {
            this.originalData = {};
            return;
        }

        function deepEqual(x, y) {
            const ok = Object.keys, tx = typeof x, ty = typeof y;
            return x && y && tx === 'object' && tx === ty ? (
                ok(x).length === ok(y).length &&
                ok(x).every(key => deepEqual(x[key], y[key]))
            ) : (x === y);
        }

        function isAllowedtype(tc: any, allowBuffer = true): boolean {
            if (tc === 'object' || tc === 'Number' || tc === 'number' || tc === 'null' || tc === 'string' || tc == 'boolean') {
                return true;
            }
            if (allowBuffer && tc === 'buffer') {
                return true;
            }
            return false;
        }

        function validateWhitelistedDatatypes(x, allowBuffer = true) {
            const ok = Object.keys;
            const tx = typeof x;
            const isAllowed = isAllowedtype(tx, allowBuffer);
            if (!isAllowed) {
                return false;
            }
            if (tx === 'object') {
                return ok(x).every(key => validateWhitelistedDatatypes(x[key], allowBuffer));
            }
            return true;
        }

        if (!validateWhitelistedDatatypes(originalData)) {
            throw new Error('Invalid payload contains disallowed data types. Use only number, string, null, or buffer');
        }

        // Also make sure that if either args, ctx, init, or meta are provided, then we never allow buffer.
        if (originalData['args']) {
            if (!validateWhitelistedDatatypes(originalData['args'], false)) {
                throw 'args field invalid due to presence of buffer type';
            }
        }
        if (originalData['ctx']) {
            if (!validateWhitelistedDatatypes(originalData['ctx'], false)) {
                throw 'ctx field invalid due to presence of buffer type';
            }
        }
        if (originalData['meta']) {
            if (!validateWhitelistedDatatypes(originalData['meta'], false)) {
                throw 'meta field invalid due to presence of buffer type';
            }
        }

        const payload = {
            ...originalData
        }
        const cborEncoded = cbor.encode(payload);
        // Decode to do sanity check
        const cborDecoded = cbor.decode(cborEncoded);
        if (!deepEqual(cborDecoded, payload)) {
            throw 'CBOR Decode error objects are not the same. Developer error';
        }
        if (!deepEqual(originalData, payload)) {
            throw 'CBOR Payload Decode error objects are not the same. Developer error';
        }
        this.cborEncoded = cborEncoded;
    }
    get(): any {
        return this.originalData;
    }
    cbor(): any {
        return this.cborEncoded;
    }
}

export const appendMintUpdateRevealScript = (opType: 'nft' | 'ft' | 'dft' | 'dmt' | 'sl' | 'x' | 'y' | 'mod' | 'evt' | 'dat', keypair: KeyPairInfo, payload: AtomicalsPayload, log: boolean = true) => {
    let ops = `${keypair.childNodeXOnlyPubkey.toString('hex')} OP_CHECKSIG OP_0 OP_IF `;
    ops += `${Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, 'utf8').toString('hex')}`;
    ops += ` ${Buffer.from(opType, 'utf8').toString('hex')}`;
    const chunks = chunkBuffer(payload.cbor(), 520);
    for (let chunk of chunks) {
        ops += ` ${chunk.toString('hex')}`;
    }
    ops += ` OP_ENDIF`;
    return ops;
};

export const guessPrefixType = (id: any): any => {
    if (id.startsWith('#')) {
        return id;
    }
    if (id.startsWith('+')) {
        return id;
    }
    if (id.startsWith('$')) {
        return id;
    }
    if (id.indexOf('.') !== -1) {
        return id;
    }
    return id;
}

export const normalizeIdentifier = (id: any, expectedType?: AtomicalIdentifierType): any => {
    switch (expectedType) {
        case null:
            return guessPrefixType(id);
        case AtomicalIdentifierType.CONTAINER_NAME:
            return id.startsWith('#') ? id : '#' + id;
        case AtomicalIdentifierType.REALM_NAME:
            return id.startsWith('+') ? id : '+' + id;
        case AtomicalIdentifierType.TICKER_NAME:
            return id.startsWith('$') ? id : '$' + id;
        default:
    }
    return id;
}

export const getAndCheckAtomicalInfo = async (electrumApi: ElectrumApiInterface, atomicalAliasOrId: any, expectedOwnerAddress: string, expectedType = 'NFT', expectedSubType: any = null)
    : Promise<{ atomicalInfo: any; locationInfo: any, inputUtxoPartial: IInputUtxoPartial }> => {

    const getLocationCommand = new ResolveCommand(electrumApi, atomicalAliasOrId, AtomicalsGetFetchType.LOCATION);
    const getLocationResponse = await getLocationCommand.run();
    if (!getLocationResponse.success) {
        console.log(JSON.stringify(getLocationResponse, null, 2));
        throw new Error(`Error: Unable to get location.`)
    }
    const atomicalInfo = getLocationResponse.data.result;
    if (expectedType === 'NFT' && atomicalInfo.type !== expectedType) {
        console.log('atomicalInfo', atomicalInfo);
        throw `Atomical is not an type ${expectedType}. It is expected to be an ${expectedType} type. atomicalAliasOrId=${atomicalAliasOrId}`;
    }

    if (expectedType === 'FT' && atomicalInfo.type !== expectedType) {
        console.log('atomicalInfo', atomicalInfo);
        throw `Atomical is not an type ${expectedType}. It is expected to be an ${expectedType} type. atomicalAliasOrId=${atomicalAliasOrId}`;
    }

    if (expectedSubType && atomicalInfo.subtype !== expectedSubType) {
        console.log('atomicalInfo', atomicalInfo);
        throw `Atomical is not subtype ${expectedSubType}. It is expected to be an ${expectedSubType} type. atomicalAliasOrId=${atomicalAliasOrId}`;
    }

    const atomicalDecorated = decorateAtomical(atomicalInfo);
    let locationInfoObj = atomicalDecorated.location_info_obj;
    let locationInfo = locationInfoObj.locations;
    // Check to make sure that the location is controlled by the same address as supplied by the WIF
    if (!locationInfo || !locationInfo.length || locationInfo[0].address !== expectedOwnerAddress) {
        const address = locationInfo?.[0]?.address;
        if (address) {
            throw `Atomical is controlled by a different address (${address}) than the provided wallet (${expectedOwnerAddress})`;
        } else {
            throw 'Atomical is no longer controlled.';
        }
    }
    locationInfo = locationInfo[0];
    const inputUtxoPartial: any = IsAtomicalOwnedByWalletRecord(expectedOwnerAddress, atomicalDecorated);
    return {
        atomicalInfo,
        locationInfo,
        inputUtxoPartial
    }
}   
