import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as cloneDeep from 'lodash.clonedeep';
import { BitworkInfo, buildAtomicalsFileMapFromRawTx, getTxIdFromAtomicalId, hexifyObjectWithUtf8, isValidBitworkConst, isValidBitworkString } from "../utils/atomical-format-helpers";
import { fileWriter, jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import * as fs from 'fs';
import * as mime from 'mime-types';
import { FileMap } from "../interfaces/filemap.interface";
import { basename, extname } from "path";
import { hash256 } from 'bitcoinjs-lib/src/crypto';
import { MerkleTree } from 'merkletreejs'
const SHA256 = require('crypto-js/sha256')
import { sha256 } from "js-sha256";
function isInvalidImageExtension(extName) {
  return extName !== '.jpg' && extName !== '.gif' && extName !== '.jpeg' && extName !== '.png' && extName !== '.svg' && extName !== '.webp' &&
    extName !== '.mp3' && extName !== '.mp4' && extName !== '.mov' && extName !== '.webm' && extName !== '.avi' && extName !== '.mpg'
}
function isJsonExtension(extName) {
  return extName === '.json';
}
export class CreateDmintCommand implements CommandInterface {
  constructor(
    private folder: string,
    private mintHeight: number,
    private bitworkc: string
  ) {
    if (this.mintHeight < 0 || this.mintHeight > 10000000) {
      throw new Error('Invalid Mint height')
    }
    if (!isValidBitworkConst(bitworkc) && !isValidBitworkString(bitworkc)) {
      throw new Error(`Invalid Bitwork string. When in doubt use '7777'`)
    }
  }
  async run(): Promise<any> {
    let counter = 0;
    const files = fs.readdirSync(this.folder);
    const leafItems: any = [];
    const jsonFiles = {};
    for (const file of files) {
      if (file.startsWith('.') || file.startsWith('dmint')) {
        console.log(`Skipping ${file}...`);
        continue;
      }
      counter++;
      const jsonFile: any = await jsonFileReader(`${this.folder}/${file}`)
      jsonFiles[jsonFile['data']['args']['request_dmitem']] = jsonFile;
      const itemName = jsonFile['data']['args']['request_dmitem'];
      const mainName = jsonFile['data']['args']['main'];
      const mainFile = Buffer.from(jsonFile['data'][mainName]['$b'], 'hex');
      const hashed = hash256(mainFile);
      const hashedStr = hashed.toString('hex');
      if (jsonFile['data']['args']['bitworkc'] === 'any') {
        throw new Error('cannot use ANY bitworkc in item');
      }
      if (jsonFile['data']['args']['bitworkr'] === 'any') {
        throw new Error('cannot use ANY bitworkr in item');
      }
      let itemBitworkc = 'any';
      if (jsonFile['data']['args']['bitworkc']) {
        itemBitworkc = jsonFile['data']['args']['bitworkc'] ? jsonFile['data']['args']['bitworkc'] : 'any';
      }
      let itemBitworkr = 'any';
      if (jsonFile['data']['args']['bitworkr']) {
        itemBitworkr = jsonFile['data']['args']['bitworkr'] ? jsonFile['data']['args']['bitworkr'] : 'any';
      }
      const leafVector = itemName + ':' + itemBitworkc + ':' + itemBitworkr + ':' + mainName + ':' + hashedStr;
      leafItems.push({
        itemName,
        file,
        leafVector,
        hashedStr
      });
    };
    const leaves = leafItems.map(x => SHA256(x.leafVector))
    const tree = new MerkleTree(leaves, SHA256)
    const root = tree.getRoot().toString('hex')
    let items = 0;
    for (const leafItem of leafItems) {
      const leaf = SHA256(leafItem.leafVector)
      const proof = tree.getProof(leaf)
      tree.verify(proof, leaf, root)
      jsonFiles[leafItem.itemName]['data']['args']['proof'] = (proof.map((item) => {
        return {
          p: item.position === 'right' ? true : item.position === 'left' ? false : null,
          d: item.data.toString('hex')
        }
      }));
      jsonFiles[leafItem.itemName]['targetVector'] = leafItem.leafVector
      jsonFiles[leafItem.itemName]['targethash'] = leafItem.hashedStr
      await jsonFileWriter(`${this.folder}/${leafItem.file}`, jsonFiles[leafItem.itemName]);
      items++;
    }
    const timestamp = (new Date()).getTime();
    const dmintFilename = 'dmint-' + timestamp + '.json';
    await jsonFileWriter(`${this.folder}/${dmintFilename}`, {
      dmint: {
        v: "1",
        mint_height: this.mintHeight,
        merkle: root,
        immutable: true,
        items,
        rules: [
          {
            p: ".*",
            bitworkc: this.bitworkc
          }
        ]
      }
    });

    return {
      success: true,
      data: {
        folder: this.folder,
        totalItems: counter,
      }
    };
  }
}