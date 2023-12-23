
import * as ecc from 'tiny-secp256k1';
import {
  initEccLib,
  script,
  Transaction
} from "bitcoinjs-lib";
import { bitcoin } from '..';
import * as dotenv from 'dotenv'
dotenv.config();
initEccLib(ecc);
import * as cbor from 'borc';
import { AtomicalStatus, LocationInfo } from '../interfaces/atomical-status.interface';
import { detectScriptToAddressType } from "./address-helpers";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from '../types/protocol-tags';
import { BASE_REQUEST_OPTS_DEFAULTS, BaseRequestOptions } from '../interfaces/api.interface';
import * as CrockfordBase32 from 'crockford-base32';
const mintnft = 'nft';
const mintft = 'ft';
const mintdft = 'dft';
const update = 'mod';
const event = 'evt';
const storedat = 'dat';

export enum AtomicalIdentifierType {
  ATOMICAL_ID = 'ATOMICAL_ID',
  ATOMICAL_NUMBER = 'ATOMICAL_NUMBER',
  REALM_NAME = 'REALM_NAME',
  CONTAINER_NAME = 'CONTAINER_NAME',
  TICKER_NAME = 'TICKER_NAME',
}
export interface AtomicalResolvedIdentifierReturn {
  type: AtomicalIdentifierType;
  providedIdentifier: any;
  realmName?: string;
  containerName?: string;
  tickerName?: string;
}

export const isObject = (p): boolean => {
  if (
    typeof p === 'object' &&
    !Array.isArray(p) &&
    p !== null
  ) {
    return true;
  }
  return false
}

export const encodeAtomicalIdToBinaryElementHex = (v) => {
  if (!isAtomicalId(v)) {
    throw new Error('Not atomical Id ' + v)
  }
  const result = compactIdToOutpointBytesAndHex(v);
  return {
    "$b": result.hex
  };
}

export const encodeAtomicalIdToBuffer = (v) => {
  if (!isAtomicalId(v)) {
    throw new Error('Not atomical Id ' + v)
  }
  const result = compactIdToOutpointBytesAndHex(v);
  return result.buf;
}

export const encodeHashToBuffer = (v) => {
  if (!v || v.length !== 64) {
    throw new Error('Not valid sha256 hash ' + v)
  }
  return Buffer.from(v, 'hex');
}

export const encodeIds = (jsonObject, updatedObject, atomicalIdEncodingFunc, otherEncodingFunc, autoEncodePattern?: string) => {
  if (!isObject(jsonObject)) {
    return;
  }
  for (const prop in jsonObject) {
    if (!jsonObject.hasOwnProperty(prop)) {
      continue;
    }
    if (prop === 'id' && isAtomicalId(jsonObject['id'])) {
      updatedObject[prop] = atomicalIdEncodingFunc(jsonObject['id'])
    } else if (autoEncodePattern && prop.endsWith(autoEncodePattern)) {
      updatedObject[prop] = otherEncodingFunc(jsonObject[prop])
    } else {
      updatedObject[prop] = jsonObject[prop]
      encodeIds(jsonObject[prop], updatedObject[prop], atomicalIdEncodingFunc, otherEncodingFunc, autoEncodePattern)
    }
  }
  return updatedObject;
}

/** Checks whether a string is an atomicalId, realm/subrealm name, container or ticker */
export const getAtomicalIdentifierType = (providedIdentifier: any): AtomicalResolvedIdentifierReturn => {
  if (isAtomicalId(providedIdentifier)) {
    return {
      type: AtomicalIdentifierType.ATOMICAL_ID,
      providedIdentifier
    }
  }

  if (providedIdentifier === null) {
    throw new Error('atomicalId, number or name of some kind must be provided such as +name, $ticker, or #container');
  }

  if (parseInt(providedIdentifier, 10) == providedIdentifier) {
    return {
      type: AtomicalIdentifierType.ATOMICAL_NUMBER,
      providedIdentifier
    }
  }
  // If it's a realm/subrealm
  if (providedIdentifier.startsWith('+')) {
    return {
      type: AtomicalIdentifierType.REALM_NAME,
      providedIdentifier: providedIdentifier,
      realmName: providedIdentifier.substring(1),
    }
  } else if (providedIdentifier.indexOf('.') !== -1) {
    // If there is at least one dot . then assume it's a subrealm type
    return {
      type: AtomicalIdentifierType.REALM_NAME,
      providedIdentifier: providedIdentifier,
      realmName: providedIdentifier,
    }
  }
  else if (providedIdentifier.startsWith('#')) {
    return {
      type: AtomicalIdentifierType.CONTAINER_NAME,
      providedIdentifier: providedIdentifier,
      containerName: providedIdentifier.substring(1),
    }
  } else if (providedIdentifier.startsWith('$')) {
    return {
      type: AtomicalIdentifierType.TICKER_NAME,
      providedIdentifier: providedIdentifier,
      tickerName: providedIdentifier.substring(1),
    }
  } else {
    // Since there is a bug on the command line accepting the dollar sign $, we just assume it's a ticker if it's a raw string
    // The way to get the command line to accept the dollar sign is put the argument in single quotes like: yarn cli get '$ticker'
    return {
      type: AtomicalIdentifierType.TICKER_NAME,
      providedIdentifier: providedIdentifier,
      tickerName: providedIdentifier
    }
  }
}

export function isAtomicalId(atomicalId) {
  if (!atomicalId || !atomicalId.length || atomicalId.indexOf('i') !== 64) {
    return false;
  }
  try {
    const splitParts = atomicalId.split('i');
    const txid = splitParts[0];
    const index = parseInt(splitParts[1], 10);
    return {
      txid,
      index,
      atomicalId
    }
  } catch (err) {
  }
  return null;
}

export function getTxIdFromAtomicalId(atomicalId: string): string {
  if (atomicalId.length === 64) {
    return atomicalId;
  }
  if (atomicalId.indexOf('i') !== 64) {
    throw "Invalid atomicalId";
  }
  return atomicalId.substring(0, 64);
}

export function getIndexFromAtomicalId(atomicalId: string): number {
  if (atomicalId.indexOf('i') !== 64) {
    throw "Invalid atomicalId";
  }
  return parseInt(atomicalId.split('i')[1], 10)
}

export function outpointToCompactId(outpointHex: string): string {
  if (outpointHex.length !== 72) {
    throw new Error('Invalid outpoint hex')
  }
  const txidPart = outpointHex.substring(0, 64);
  const numPart = outpointHex.substring(64);
  const txid = Buffer.from(txidPart, 'hex').reverse().toString('hex')
  let indexNum = Buffer.from(numPart, 'hex').readUint32LE();
  let compactId = txid + 'i' + indexNum;
  return compactId;
}

/** Convert a location_id or atomical_id to the outpoint (36 bytes hex string) */
export function compactIdToOutpoint(locationId: string): string {
  let txid: any = getTxIdFromAtomicalId(locationId);
  txid = Buffer.from(txid, 'hex').reverse();
  const index = getIndexFromAtomicalId(locationId);
  let numberValue: any = Buffer.allocUnsafe(4)
  numberValue.writeUint32LE(index)
  return txid.toString('hex') + numberValue.toString('hex');
}

export function compactIdToOutpointBytesAndHex(locationId: string): { buf: any, hex: string } {
  let txid: any = getTxIdFromAtomicalId(locationId);
  txid = Buffer.from(txid, 'hex').reverse();
  const index = getIndexFromAtomicalId(locationId);
  let numberValue: any = Buffer.allocUnsafe(4)
  numberValue.writeUint32LE(index);
  return {
    buf: Buffer.concat([txid, numberValue]),
    hex: txid.toString('hex') + numberValue.toString('hex'),
  }
}

export function parseAtomicalsDataDefinitionOperation(opType, script, n, hexify = false, addUtf8 = false) {
  let rawdata: any = Buffer.allocUnsafe(0)
  try {
    while (n < script.length) {
      const op = script[n]
      n += 1
      // define the next instruction type
      if (op == bitcoin.opcodes.OP_ENDIF) {
        break;
      } else if (Buffer.isBuffer(op)) {
        rawdata = Buffer.concat([rawdata, op])
      }
    }
  }
  catch (err) {
    throw 'parse_atomicals_mint_operation script error';
  }
  console.log('decoded', rawdata);
  let decoded = {}
  try {
    decoded = decodePayloadCBOR(rawdata, hexify, addUtf8);
  } catch (error) {
    console.log('Error for atomical CBOR parsing ', error);
    throw error;
  }
  if (hexify) {
    rawdata = rawdata.toString('hex');
  }
  return {
    opType,
    rawdata,
    decoded
  }
}

export function extractFileFromInputWitness(inputWitness: any[], hexify = false, addUtf8 = false, markerSentinel = ATOMICALS_PROTOCOL_ENVELOPE_ID): any {
  for (const item of inputWitness) {
    const witnessScript: any = script.decompile(item);
    if (!witnessScript) {
      continue; // not valid script
    }
    for (let i = 0; i < witnessScript.length; i++) {
      if (witnessScript[i] === bitcoin.opcodes.OP_IF) {
        do {
          if (Buffer.isBuffer(witnessScript[i]) && witnessScript[i].toString('utf8') === markerSentinel) {
            for (; i < witnessScript.length; i++) {
              if (Buffer.isBuffer(witnessScript[i])) {
                const opType = witnessScript[i].toString('utf8');
                if (Buffer.isBuffer(witnessScript[i]) && (opType === mintnft || opType === update || opType === mintft || opType === mintdft || opType === event || opType == storedat)) {

                  return parseAtomicalsDataDefinitionOperation(opType, witnessScript, i + 1, hexify, addUtf8);
                }
              }
            }
          }
          i++
          if (i >= witnessScript.length) {
            break;
          }
        } while (witnessScript[i] !== bitcoin.opcodes.OP_ENDIF)
      }
    }
  }
  return {
  }
}

export function buildAtomicalsFileMapFromRawTx(rawtx: string, hexify = false, addUtf8 = false, markerSentinel = ATOMICALS_PROTOCOL_ENVELOPE_ID): any {
  const tx = Transaction.fromHex(rawtx);
  const filemap = {}
  let i = 0;
  for (const input of tx.ins) {
    if (input.witness) {
      const fileInWitness = extractFileFromInputWitness(input.witness, hexify, addUtf8, markerSentinel);
      if (fileInWitness) {
        filemap[i] = fileInWitness
      }
    }
    i++;
  }
  return filemap
}

export function decodePayloadCBOR(payload: any, hexify = true, addUtf8 = false): any {
  if (hexify) {
    return hexifyObjectWithUtf8(cbor.decode(payload), addUtf8);
  } else {
    return cbor.decode(payload);
  }
}

const errMessage = 'Invalid --bitwork value. Must be hex with a single optional . dot separated with a number of 1 to 15 with no more than 10 hex characters. Example: 0123 or 3456.12';

export const isBitworkRefBase32Prefix = (bitwork): string | null => {
  if (/^[abcdefghjkmnpqrstvwxyz0-9]{1,10}$/.test(bitwork)) {
    const enc = CrockfordBase32.CrockfordBase32.decode(bitwork);
    return enc.toString('hex').toLowerCase();
  }
  return null
}

export const isBitworkHexPrefix = (bitwork) => {
  if (/^[a-f0-9]{1,10}$/.test(bitwork)) {
    return true;
  }
  return false
}

export const isValidBitworkHex = (bitwork) => {
  if (!/^[a-f0-9]{1,10}$/.test(bitwork)) {
    throw new Error(errMessage)
  }
}

export const hasAtomicalType = (type: string, atomicals: any[]): any => {
  for (const item of atomicals) {
    if (item.type === type) {
      return true;
    }
  }
  return false;
}

export const hasValidBitwork = (txid, bitwork: string, bitworkx: number) => {
  if (txid.startsWith(bitwork)) {
    if (!bitworkx) {
      return true;
    } else {
      const next_char = txid[bitwork.length]
      const char_map = {
        '0': 0,
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6,
        '7': 7,
        '8': 8,
        '9': 9,
        'a': 10,
        'b': 11,
        'c': 12,
        'd': 13,
        'e': 14,
        'f': 15
      }
      const get_numeric_value = char_map[next_char]
      if (get_numeric_value >= bitworkx) {
        return true;
      }
    }
  }
  return false;
}

export interface BitworkInfo {
  input_bitwork: string;
  hex_bitwork: string;
  prefix: string;
  ext: number | undefined;
}

export const checkBaseRequestOptions = (options: any): BaseRequestOptions => {
  if (!options) {
    options = BASE_REQUEST_OPTS_DEFAULTS;
  } else if (!options.satsbyte) {
    options.satsbyte = 10;
  }
  if (!options.satsoutput) {
    options.satsoutput = 546;
  }
  if (typeof options.satsbyte !== 'number') {
    options.satsbyte = parseInt(options.satsbyte as any, 10);
  }
  if (typeof options.satsoutput !== 'number') {
    options.satsoutput = parseInt(options.satsoutput as any, 10);
  }
  return options;
}

export const isValidBitworkMinimum = (bitworkc: any) => {
  if (!bitworkc) {
    throw new Error('Require at least 4 hex digits or 3 ascii digits for any bitwork.')
  }
  const bitworkInfoCommit = isValidBitworkString(bitworkc);
  if (bitworkInfoCommit?.prefix && bitworkInfoCommit?.prefix.length < 4) {
    console.log('bitworkInfoCommit', bitworkInfoCommit);
    throw new Error('Require at least --bitworkc with 4 hex digits or 3 ascii digits.')
  }
}
export const isValidBitworkConst = (bitwork_val: any): boolean => {
  return bitwork_val === 'any';
}
export const isValidBitworkString = (fullstring, safety = true): BitworkInfo | null => {
  if (!fullstring) {
    throw new Error(errMessage);
  }

  if (fullstring && fullstring.indexOf('.') === -1) {
    if (isBitworkHexPrefix(fullstring)) {
      return {
        input_bitwork: fullstring,
        hex_bitwork: fullstring,
        prefix: fullstring,
        ext: undefined
      };
    } else if (isBitworkRefBase32Prefix(fullstring)) {
      const hex_encoded: string | any = isBitworkRefBase32Prefix(fullstring);
      if (!hex_encoded) {
        throw new Error('invalid base32 encoding: ' + fullstring);
      }
      return {
        input_bitwork: fullstring,
        hex_bitwork: hex_encoded,
        prefix: hex_encoded,
        ext: undefined
      };
    } else {
      throw new Error('Invalid bitwork string: ' + fullstring)
    }
  }

  const splitted = fullstring.split('.');
  if (splitted.length !== 2) {
    throw new Error(errMessage)
  }

  let hex_prefix: any = null;
  if (isBitworkHexPrefix(splitted[0])) {
    hex_prefix = splitted[0];
  } else if (isBitworkRefBase32Prefix(splitted[0])) {
    hex_prefix = isBitworkRefBase32Prefix(splitted[0]);
    if (!hex_prefix) {
      throw new Error('invalid base32 encoding: ' + splitted[0]);
    }
  } else {
    throw new Error('Invalid bitwork string: ' + fullstring)
  }

  const parsedNum = parseInt(splitted[1], 10);
  if (isNaN(parsedNum)) {
    throw new Error(errMessage)
  }
  if (parsedNum <= 0 || parsedNum > 15) {
    throw new Error(errMessage)
  }

  if (safety) {
    if (splitted[0].length >= 10) {
      throw new Error('Safety check triggered: Prefix length is >= 8. Override with safety=false');
    }
  }
  let hex_bitwork = '';
  if (parsedNum) {
    hex_bitwork = `${hex_prefix}.${parsedNum}`;
  }
  return {
    input_bitwork: fullstring,
    hex_bitwork: hex_bitwork,
    prefix: hex_prefix,
    ext: parsedNum,
  }
}

export const isValidNameBase = (name: string, isTLR = false) => {
  if (!name) {
    throw new Error('Null name');
  }
  if (name.length > 64 || name.length === 0) {
    throw new Error('Name cannot be longer than 64 characters and must be at least 1 character');
  }

  if (name[0] === '-') {
    throw new Error('Name cannot begin with a hyphen');
  }
  if (name[name.length - 1] === '-') {
    throw new Error('Name cannot end with a hyphen');
  }
  if (isTLR) {
    if (name[0] >= '0' && name[0] <= '9') {
      throw new Error('Top level realm name cannot start with a number');
    }
  }
  return true;
}

export const isValidDmitemName = (name: string) => {
  isValidNameBase(name);
  if (!/^[a-z0-9][a-z0-9\-]{0,63}$/.test(name)) {
    throw new Error('Invalid dmitem name: ' + name);
  }
  return true;
}

export const isValidContainerName = (name: string) => {
  isValidNameBase(name);
  if (!/^[a-z0-9][a-z0-9\-]{0,63}$/.test(name)) {
    throw new Error('Invalid container name');
  }
  return true;
}

export const isValidRealmName = (name: string) => {
  const isTLR = true;
  isValidNameBase(name, isTLR);
  if (!/^[a-z][a-z0-9\-]{0,63}$/.test(name)) {
    throw new Error('Invalid realm name');
  }
  return true;
}

export const isValidSubRealmName = (name: string) => {
  isValidNameBase(name);
  if (!/^[a-z0-9][a-z0-9\-]{0,63}$/.test(name)) {
    throw new Error('Invalid subrealm name');
  }
  return true;
}

export const isValidTickerName = (name: string) => {
  isValidNameBase(name);
  if (!/^[a-z0-9]{1,21}$/.test(name)) {
    throw new Error('Invalid ticker name');
  }
  return true;
}

export function hexifyObjectWithUtf8(obj: any, utf8 = true): any {
  function isBuffer(obj) {
    return Buffer.isBuffer(obj);
  }

  function isObject(obj) {
    return typeof obj === 'object' && !Array.isArray(obj) && obj !== null
  }

  const stackOfKeyRefs: any = [obj]
  do {
    const nextObjectLayer = stackOfKeyRefs.pop();
    for (const key in nextObjectLayer) {

      if (!nextObjectLayer.hasOwnProperty(key)) {
        continue;
      }
      if (isObject(nextObjectLayer[key]) && !isBuffer(nextObjectLayer[key])) {
        stackOfKeyRefs.push(nextObjectLayer[key])
      } else if (isBuffer(nextObjectLayer[key])) {
        if (utf8) {
          nextObjectLayer[key + '-utf8'] = nextObjectLayer[key].toString('utf8')
        }
        nextObjectLayer[key] = nextObjectLayer[key].toString('hex')
      }
    }
  } while (stackOfKeyRefs.length);
  return obj;
}

export function expandDataDecoded(record: any, hexify = true, addUtf8 = false) {
  if (record && record.mint_info) {
    try {
      record.mint_info['data_decoded'] = decodePayloadCBOR(record.mint_info['data'], hexify, addUtf8);
    } catch (error) {
    }
  }
  return record;
}

export function expandLocationInfo(record: AtomicalStatus) {
  if (record && record.location_info_obj) {
    const location_info: LocationInfo = record.location_info_obj;
    const locations = location_info.locations;
    const updatedLocations: any[] = [];
    for (const locationItem of locations) {
      let detectedAddress;
      try {
        detectedAddress = detectScriptToAddressType(locationItem.script)
      } catch (err) {
      }
      updatedLocations.push(Object.assign(
        {},
        locationItem,
        {
          address: detectedAddress
        }
      ))
    }
    record.location_info_obj.locations = updatedLocations;
  }
  return record;
}

export function expandMintBlockInfo(record: any) {
  if (record && record.mint_info) {
    let blockheader_info: any = undefined;
    if (record.mint_info.reveal_location_height &&
      record.mint_info.reveal_location_height > 0 &&
      record.mint_info.reveal_location_header &&
      record.mint_info.reveal_location_header !== '') {
      blockheader_info = bitcoin.Block.fromHex(record.mint_info.reveal_location_header);
      blockheader_info.prevHash = blockheader_info.prevHash.reverse().toString('hex');
      blockheader_info.merkleRoot = blockheader_info.merkleRoot.reverse().toString('hex');

    }
    record.mint_info = Object.assign(
      {},
      record.mint_info,
      {
        reveal_location_address: detectScriptToAddressType(record.mint_info.reveal_location_script),
        blockheader_info
      }
    )
  }
  return record;
}

export function decorateAtomicals(records: any, addUtf8 = false) {
  return records.map((item) => {
    return decorateAtomical(item, addUtf8);
  });
}

export function decorateAtomical(item: any, addUtf8 = false) {
  expandMintBlockInfo(item)
  expandLocationInfo(item)
  expandDataDecoded(item, true, addUtf8)
  return item;
}

// 2QwqwqWWqSWwwqws

/**
 * validates that the rules matches a valid format
 * @param object The object which contains the 'rules' field
 */
export function validateSubrealmRulesObject(topobject) {
  if (!topobject || !topobject.subrealms) {
    throw new Error(`File path does not contain top level 'subrealms' object element`);
  }
  const object = topobject.subrealms;
  if (!object || !object.rules || !Array.isArray(object.rules) || !object.rules.length) {
    throw new Error(`File path does not contain top level 'rules' array element with at least one rule set`);
  }
  for (const ruleset of object.rules) {
    const regexRule = ruleset.p;
    const outputRulesMap = ruleset.o;
    const modifiedPattern = '^' + regexRule + '$';
    // Test that the regex is valid
    new RegExp(modifiedPattern)
    if (!regexRule) {
      throw new Error('Aborting invalid regex pattern')
    }
    for (const propScript in outputRulesMap) {
      if (!outputRulesMap.hasOwnProperty(propScript)) {
        continue;
      }
      const priceRuleObject = outputRulesMap[propScript]
      const priceRuleValue = priceRuleObject.v;
      const priceRuleTokenType = priceRuleObject['id'];

      if (priceRuleValue < 0) {
        throw new Error('Aborting minting because price is less than 0')
      }
      if (priceRuleValue > 100000000000) {
        throw new Error('Aborting minting because price is greater than 1000')
      }
      if (isNaN(priceRuleValue)) {
        throw new Error('Price is not a valid number')
      }
      if (priceRuleTokenType && !isAtomicalId(priceRuleTokenType)) {
        throw new Error('id parameter must be a compact atomical id: ' + priceRuleTokenType);
      }
      try {
        const result = detectScriptToAddressType(propScript);
      } catch (ex) {
        // Technically that means a malformed payment *could* possibly be made and it would work.
        // But it's probably not what either party intended. Therefore warn the user and bow out.
        throw new Error('Realm rule output format is not a valid address script. Aborting...');
      }
    }
  }
}
