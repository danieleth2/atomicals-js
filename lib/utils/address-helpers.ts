import * as bs58check from "bs58check";
import { sha256 } from "js-sha256";
import * as ecc from 'tiny-secp256k1';
import { IValidatedWalletInfo, IWalletRecord } from "./validate-wallet-storage";
import { AtomicalStatus, Location, LocationInfo } from "../interfaces/atomical-status.interface";
import { IInputUtxoPartial } from "../types/UTXO.interface";
import { NETWORK } from "../commands/command-helpers";
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import * as dotenv from 'dotenv'
import { toXOnly } from "./create-key-pair";
import { Network } from "bitcoinjs-lib";
dotenv.config();

export function detectAddressTypeToScripthash(address: string): { output: string, scripthash: string, address: string } {
  // Detect legacy address
  try {
    bitcoin.address.fromBase58Check(address, NETWORK);
    const p2pkh = addressToP2PKH(address);
    const p2pkhBuf = Buffer.from(p2pkh, "hex");
    return {
      output: p2pkh,
      scripthash: Buffer.from(sha256(p2pkhBuf), "hex").reverse().toString("hex"),
      address
    }
  } catch (err) {
  }
  // Detect segwit or taproot
  // const detected = bitcoin.address.fromBech32(address);
  if (address.indexOf('bc1p') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  } else if (address.indexOf('bc1') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  } else if (address.indexOf('tb1') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  } else if (address.indexOf('bcrt1p') === 0) {
    const output = bitcoin.address.toOutputScript(address, NETWORK);
    return {
      output,
      scripthash: Buffer.from(sha256(output), "hex").reverse().toString("hex"),
      address
    }
  }
  else {
    throw "unrecognized address";
  }
}

export function detectScriptToAddressType(script: string): string {
  const address = bitcoin.address.fromOutputScript(Buffer.from(script, 'hex'), NETWORK)
  return address;
}


export function addressToScripthash(address: string): string {
  const p2pkh = addressToP2PKH(address);
  const p2pkhBuf = Buffer.from(p2pkh, "hex");
  return Buffer.from(sha256(p2pkhBuf), "hex").reverse().toString("hex");
}

export function addressToP2PKH(address: string): string {
  const addressDecoded = bs58check.decode(address);
  const addressDecodedSub = addressDecoded.toString().substr(2);
  const p2pkh = `76a914${addressDecodedSub}88ac`;
  return p2pkh;
}

export function addressToHash160(address: string): string {
  const addressDecoded = bs58check.decode(address);
  const addressDecodedSub = addressDecoded.toString().substr(2);
  return addressDecodedSub;
}
export function hash160BufToAddress(hash160: Buffer): string {
  const addressEncoded = bs58check.encode(hash160);
  return addressEncoded;
}
export function hash160HexToAddress(hash160: string): string {
  const addressEncoded = bs58check.encode(Buffer.from(hash160, "hex"));
  return addressEncoded;
}

export function performAddressAliasReplacement(walletInfo: IValidatedWalletInfo, address: string) {
  let addressToReturn;
  if (address === 'primary') {
    addressToReturn = walletInfo.primary.address;
  }
  else if (address === 'funding') {
    addressToReturn = walletInfo.funding.address;
  }
  else if (walletInfo.imported && walletInfo.imported[address]) {
    addressToReturn = walletInfo.imported[address].address;
  } else {
    addressToReturn = address
  }
  if (!addressToReturn) {
    return addressToReturn;
  }
  return detectAddressTypeToScripthash(addressToReturn)
}

/**
 * Whether the atomical for the mint is owned by the provided wallet or not
 * @param ownerRecord The proposed wallet that owns the atomical
 * @param atomical 
 * @returns 
 */
export function IsAtomicalOwnedByWalletRecord(address: string, atomical: AtomicalStatus): IInputUtxoPartial | null {
  if (!(atomical.location_info_obj as any)) {
    console.log(atomical)
    throw new Error('Error: location_info_obj not found');
  }
  const locationInfo: any = atomical.location_info_obj;
  const currentLocation = locationInfo.locations[0] || {};
  return GetUtxoPartialFromLocation(address, currentLocation, false);
}

export function GetUtxoPartialFromLocation(addressToCheck: string, location: Location, throwOnMismatch = true): IInputUtxoPartial | null {
  if (!location) {
    throw new Error('Error: location not found');
  }
  // Just in case populate the address on locationInfo if it was not set
  // It can be deduced from the script field
  let detectedAddress;
  try {
    detectedAddress = detectScriptToAddressType(location.script)
  } catch (err) {
    throw new Error('Error: invalid script address');
  }
  location.address = detectedAddress;
  if (addressToCheck !== location.address as any) {
    if (throwOnMismatch) {
      throw new Error('location_info not match expected address. expectedAddress=' + addressToCheck + ', foundAddress=' + location.address);
    }
    return null;
  }
  return {
    hash: location.txid,
    index: Number(location.index),
    address: detectedAddress,
    witnessUtxo: {
      value: Number(location.value),
      script: Buffer.from(location.script, 'hex')
    }
  };
}

export enum AddressTypeString {
  p2pkh = 'p2pkh',
  p2tr = 'p2tr',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh',
  p2wpkh_testnet = 'p2wpkh_testnet',
  p2tr_testnet = 'p2tr_testnet',
  p2sh_testnet = 'p2sh_testnet',
  p2pkh_testnet = 'p2pkh_testnet',
  p2tr_regtest = 'p2tr_regtest',
  unknown = 'unknown',
}

export function getAddressType(address: string): AddressTypeString {
  if (address.startsWith('bc1q')) {
    return AddressTypeString.p2wpkh;
  } else if (address.startsWith('bc1p')) {
    return AddressTypeString.p2tr;
  } else if (address.startsWith('1')) {
    return AddressTypeString.p2pkh;
  } else if (address.startsWith('3')) {
    return AddressTypeString.p2sh;
  } else if (address.startsWith('tb1q')) {
    return AddressTypeString.p2wpkh_testnet;
  } else if (address.startsWith('m')) {
    return AddressTypeString.p2pkh_testnet;
  } else if (address.startsWith('2')) {
    return AddressTypeString.p2sh_testnet;
  } else if (address.startsWith('tb1p')) {
    return AddressTypeString.p2tr_testnet;
  } else if (address.startsWith('bcrt1p')) {
    return AddressTypeString.p2tr_regtest;
  } else {
    return AddressTypeString.unknown;
  }
}

export function utxoToInput(
  utxo: any,
  address: string,
  publicKey: string,
  option: {
    override: {
      vout?: number;
      script?: string | Buffer;
    };
  },
) {
  const addressType = getAddressType(address);
  let script;

  if (option.override.script !== undefined) {
    script = Buffer.isBuffer(option.override.script!)
      ? option.override.script
      : Buffer.from(option.override.script!, 'hex');
  } else {
    script = utxo.script ? Buffer.from(utxo.script, 'hex') : undefined;
  }

  switch (addressType) {
    case AddressTypeString.p2pkh || AddressTypeString.p2pkh_testnet: {
      const { output } = detectAddressTypeToScripthash(address);
      // have transform script to scripthash, use witnessScript
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script: Buffer.from(output as string, 'hex'),
        },
      };
    }
    case AddressTypeString.p2sh || AddressTypeString.p2sh_testnet: {
      const redeemData = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(publicKey, 'hex') });
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        redeemScript: redeemData.output,
      };
    }
    case AddressTypeString.p2wpkh || AddressTypeString.p2wpkh_testnet: {
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
      };
    }
    case AddressTypeString.p2tr || AddressTypeString.p2tr_testnet || AddressTypeString.p2tr_regtest: {
      return {
        hash: utxo.txid,
        index: option.override.vout ?? utxo.vout,
        witnessUtxo: {
          value: utxo.value,
          script,
        },
        tapInternalKey: toXOnly(Buffer.from(publicKey, 'hex')),
      };
    }
  }
}


export function getNetwork(network?: Network | string) {
  if (typeof network === 'string') {
    if (network === 'testnet') {
      return bitcoin.networks.testnet;
    } else {
      return bitcoin.networks.bitcoin;
    }
  } else {
    return network;
  }
}

export function detectAddressTypeToScripthash2(
  address: string,
  network?: Network | string,
): {
  output: string | Buffer;
  scripthash: string;
  address: string;
} {
  const _network = getNetwork(network);
  // Detect legacy address
  try {
    bitcoin.address.fromBase58Check(address);
  } catch (err) {
    /* empty */
  }

  const addressType = getAddressType(address);

  switch (addressType) {
    case AddressTypeString.p2pkh: {
      const p2pkh = addressToP2PKH(address);
      const p2pkhBuf = Buffer.from(p2pkh, 'hex');
      return {
        output: p2pkh,
        scripthash: Buffer.from(sha256(p2pkhBuf), 'hex').reverse().toString('hex'),
        address,
      };
    }
    case AddressTypeString.unknown: {
      throw 'unrecognized address';
    }
    default: {
      const output = bitcoin.address.toOutputScript(address, _network);
      return {
        output,
        scripthash: Buffer.from(sha256(output), 'hex').reverse().toString('hex'),
        address,
      };
    }
  }
}
