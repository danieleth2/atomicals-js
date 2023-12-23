const bitcoin = require('bitcoinjs-lib');
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { ConfigurationInterface } from '../interfaces/configuration.interface';
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import { jsonFileReader } from './file-utils';
import { toXOnly } from './create-key-pair';
import { walletPathResolver } from './wallet-path-resolver';
import { NETWORK } from '../commands/command-helpers';
const bip32 = BIP32Factory(ecc);
const walletPath = walletPathResolver();

export interface IWalletRecord {
  address: string,
  WIF: string,
  childNode?: any
}

export interface IValidatedWalletInfo {
  primary: IWalletRecord;
  funding: IWalletRecord;
  imported: {
    [alias: string]: IWalletRecord;
  }
}

export const validateWalletStorage = async (): Promise<IValidatedWalletInfo> => {
  try {
    console.log('walletPath', walletPath);
    const wallet: any = await jsonFileReader(walletPath);
    if (!wallet.phrase) {
      console.log(`phrase field not found in ${walletPath}`);
      throw new Error(`phrase field not found in ${walletPath}`)
    }

    // Validate is a valid mnemonic
    if (!bip39.validateMnemonic(wallet.phrase)) {
      console.log('phrase is not a valid mnemonic phrase!');
      throw new Error("phrase is not a valid mnemonic phrase!");
    }

    if (!wallet.primary) {
      console.log(`Wallet needs a primary address`);
      throw new Error(`Wallet needs a primary address`);
    }

    if (!wallet.funding) {
      console.log(`Wallet needs a funding address`);
      throw new Error(`Wallet needs a funding address`);
    }

    // Validate paths
    /*if (wallet.primary.path !== `m/44'/0'/0'/0/0`) {
      console.log(`Primary path must be m/44'/0'/0'/0/0`);
      throw new Error(`Primary path must be m/44'/0'/0'/0/0`);
    }

    if (wallet.funding.path !== `m/44'/0'/0'/1/0`) {
      console.log(`Funding path must be m/44'/0'/0'/1/0`);
      throw new Error(`Funding path must be m/44'/0'/0'/1/0`);
    }*/

    // Validate WIF
    if (!wallet.primary.WIF) {
      console.log(`Primary WIF not set`);
      throw new Error(`Primary WIF not set`);
    }
    if (!wallet.funding.WIF) {
      console.log(`Funding WIF not set`);
      throw new Error(`Funding WIF not set`);
    }

    // Validate Addresses
    if (!wallet.primary.address) {
      console.log(`Primary address not set`);
      throw new Error(`Primary address not set`);
    }
    if (!wallet.funding.address) {
      console.log(`Funding address not set`);
      throw new Error(`Funding address not set`);
    }

    const seed = await bip39.mnemonicToSeed(wallet.phrase);
    const rootKey = bip32.fromSeed(seed);
    const derivePathPrimary = wallet.primary.path; //`m/44'/0'/0'/0/0`;

    const childNodePrimary = rootKey.derivePath(derivePathPrimary);

    const childNodeXOnlyPubkeyPrimary = toXOnly(childNodePrimary.publicKey);
    const p2trPrimary = bitcoin.payments.p2tr({
      internalPubkey: childNodeXOnlyPubkeyPrimary,
      network: NETWORK
    });
    if (!p2trPrimary.address || !p2trPrimary.output) {
        throw "error creating p2tr primary"
    }
    const derivePathFunding = wallet.funding.path; //`m/44'/0'/0'/1/0`;
    const childNodeFunding = rootKey.derivePath(derivePathFunding);
    const childNodeXOnlyPubkeyFunding = toXOnly(childNodeFunding.publicKey);
    const p2trFunding = bitcoin.payments.p2tr({
      internalPubkey: childNodeXOnlyPubkeyFunding,
      network: NETWORK
    });
    if (!p2trFunding.address || !p2trFunding.output) {
        throw "error creating p2tr funding"
    }
   // const derivePathFunding = `m/44'/0'/0'/1/0`;
    //const childNodeFunding = rootKey.derivePath(derivePathFunding);
   // const { address } = bitcoin.payments.p2pkh({ pubkey: childNode.publicKey });
   //  const wif = childNodePrimary.toWIF();
    const keypairPrimary = ECPair.fromWIF(wallet.primary.WIF);

    if (childNodePrimary.toWIF() !== wallet.primary.WIF) {
      throw 'primary wif does not match';
    }

    const p2trPrimaryCheck = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keypairPrimary.publicKey),
      network: NETWORK
    });

    if (p2trPrimaryCheck.address !== p2trPrimary.address && p2trPrimary.address !== wallet.primary.address) {
      const m = `primary address is not correct and does not match associated phrase at ${derivePathPrimary}. Found: ` + p2trPrimaryCheck.address;
      console.log(m);
      throw new Error(m);
    }

    const keypairFunding = ECPair.fromWIF(wallet.funding.WIF);

    if (childNodeFunding.toWIF() !== wallet.funding.WIF) {
      throw 'funding wif does not match';
    }

    const p2trFundingCheck = bitcoin.payments.p2tr({
      internalPubkey: toXOnly(keypairFunding.publicKey),
      network: NETWORK
    });

    if (p2trFundingCheck.address !== p2trFundingCheck.address && p2trFundingCheck.address !== wallet.funding.address) {
      const m = `funding address is not correct and does not match associated phrase at ${derivePathFunding}. Found: ` + p2trFundingCheck.address;
      console.log(m);
      throw new Error(m);
    }

    // Now we loop over every imported wallet and validate that they are correct
    const imported = {}
    for (const prop in wallet.imported) {
      if (!wallet.imported.hasOwnProperty(prop)) {
        continue;
      }
      // Get the wif and the address and ensure they match
      const importedKeypair = ECPair.fromWIF(wallet.imported[prop].WIF);
      // Sanity check
      if (importedKeypair.toWIF() !== wallet.imported[prop].WIF) {
        throw 'Imported WIF does not match';
      }

      const p2trImported = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(importedKeypair.publicKey),
        network: NETWORK
      });

      if (p2trImported.address !== wallet.imported[prop].address) {
        throw `Imported address does not match for alias ${prop}. Expected: ` + wallet.imported[prop].address + ', Found: ' + p2trImported.address;
      }
      imported[prop] = {
        address: p2trImported.address,
        WIF: wallet.imported[prop].WIF
      }
    }

    return {
      primary: {
        childNode: childNodePrimary,
        address: p2trPrimary.address,
        WIF: childNodePrimary.toWIF()
      },
      funding: {
        childNode: childNodeFunding,
        address: p2trFunding.address,
        WIF: childNodeFunding.toWIF()
      },
      imported
    };

  } catch (err) {
    console.log(`Error reading ${walletPath}. Create a new wallet with "npm cli wallet-init"`)
    throw err;
  }
}
