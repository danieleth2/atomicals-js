const bitcoin = require('bitcoinjs-lib');
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
import BIP32Factory from 'bip32';
import { NETWORK } from '../commands/command-helpers';
const bip32 = BIP32Factory(ecc);

const toXOnly = (publicKey) => {
    return publicKey.slice(1, 33);
}
const bip39 = require('bip39');

export const decodeMnemonicPhrase = async (phrase: string, path: string) => {
    if (!bip39.validateMnemonic(phrase)) {
        throw new Error("Invalid mnemonic phrase provided!");
    }
    const seed = await bip39.mnemonicToSeed(phrase);
    const rootKey = bip32.fromSeed(seed);
    const childNode = rootKey.derivePath(path);
    // const { address } = bitcoin.payments.p2pkh({ pubkey: childNode.publicKey });

    const childNodeXOnlyPubkey = toXOnly(childNode.publicKey);
    const p2tr = bitcoin.payments.p2tr({
        internalPubkey: childNodeXOnlyPubkey,
        network: NETWORK
    });
    if (!p2tr.address || !p2tr.output) {
        throw "error creating p2tr"
    }
    // Used for signing, since the output and address are using a tweaked key
    // We must tweak the signer in the same way.
    const tweakedChildNode = childNode.tweak(
        bitcoin.crypto.taggedHash('TapTweak', childNodeXOnlyPubkey),
    );

    return {
        phrase,
        address: p2tr.address,
        publicKey: childNode.publicKey.toString('hex'),
        publicKeyXOnly: childNodeXOnlyPubkey.toString('hex'),
        path,
        WIF: childNode.toWIF(),
        privateKey: childNode.privateKey?.toString('hex'),
    }

}