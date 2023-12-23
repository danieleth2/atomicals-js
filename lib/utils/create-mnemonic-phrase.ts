const bitcoin = require('bitcoinjs-lib');
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);
import { randomBytes } from 'crypto';
const bip39 = require('bip39');

export function createMnemonicPhrase() {
    const mnemonic = bip39.entropyToMnemonic(randomBytes(16).toString('hex'))
    if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic generated!");
    }
    return {
        phrase: mnemonic
    }
}
