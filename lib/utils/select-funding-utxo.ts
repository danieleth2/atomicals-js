import { type ElectrumApiInterface } from "../api/electrum-api.interface";
import { type UTXO } from "../types/UTXO.interface";
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import * as qrcode from 'qrcode-terminal';
bitcoin.initEccLib(ecc);

export const getInputUtxoFromTxid = async (utxo: UTXO, electrumx: ElectrumApiInterface) => {
  const txResult = await electrumx.getTx(utxo.txId);

  if (!txResult || !txResult.success) {
    throw `Transaction not found in getInputUtxoFromTxid ${utxo.txId}`;
  }
  const tx = txResult.tx;
  utxo.nonWitnessUtxo = Buffer.from(tx, 'hex');

  const reconstructedTx = bitcoin.Transaction.fromHex(tx.tx);
  if (reconstructedTx.getId() !== utxo.txId) {
    throw "getInputUtxoFromTxid txid mismatch error";
  }

  return utxo;
}

export const getFundingSelectedUtxo = async (address: string, minFundingSatoshis: number, electrumx: ElectrumApiInterface): Promise<any> => {
  // Query for a UTXO
  let listunspents = await electrumx.getUnspentAddress(address);
  let utxos = listunspents.utxos.filter((utxo) => {
    if (utxo.value >= minFundingSatoshis) {
      return utxo;
    }
  });
  if (!utxos.length) {
    throw new Error(`Unable to select funding utxo, check at least 1 utxo contains ${minFundingSatoshis} satoshis`);
  }
  const selectedUtxo = utxos[0];
  return getInputUtxoFromTxid(selectedUtxo, electrumx);
}

/**
     * Gets a funding UTXO and also displays qr code for quick deposit
     * @param electrumxApi 
     * @param address 
     * @param amount 
     * @returns 
     */
export const getFundingUtxo = async (electrumxApi, address: string, amount: number, suppressDepositAddressInfo = false, seconds = 5) => {
  // We are expected to perform commit work, therefore we must fund with an existing UTXO first to generate the commit deposit address
  if (!suppressDepositAddressInfo) {
    qrcode.generate(address, { small: false });
  }
  // If commit POW was requested, then we will use a UTXO from the funding wallet to generate it
  console.log(`...`)
  console.log(`...`)
  if (!suppressDepositAddressInfo) {
    console.log(`WAITING UNTIL ${amount / 100000000} BTC RECEIVED AT ${address}`)
  }
  console.log(`...`)
  console.log(`...`)
  const fundingUtxo = await electrumxApi.waitUntilUTXO(address, amount, seconds ? 5 : seconds, false);
  console.log(`Detected Funding UTXO (${fundingUtxo.txid}:${fundingUtxo.vout}) with value ${fundingUtxo.value} for funding...`);
  return fundingUtxo
}