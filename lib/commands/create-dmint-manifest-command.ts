import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as cloneDeep from 'lodash.clonedeep';
import { BitworkInfo, buildAtomicalsFileMapFromRawTx, getTxIdFromAtomicalId, hexifyObjectWithUtf8, isValidBitworkString, isValidDmitemName } from "../utils/atomical-format-helpers";
import { fileWriter, jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import * as fs from 'fs';
import * as mime from 'mime-types';
import { FileMap } from "../interfaces/filemap.interface";
import { basename, extname } from "path";
import { hash256 } from 'bitcoinjs-lib/src/crypto';
import { MerkleTree } from 'merkletreejs'
const SHA256 = require('crypto-js/sha256')
function isInvalidImageExtension(extName) {
  return extName !== '.jpg' && extName !== '.gif' && extName !== '.jpeg' && extName !== '.png' && extName !== '.svg' && extName !== '.webp' &&
    extName !== '.mp3' && extName !== '.mp4' && extName !== '.mov' && extName !== '.webm' && extName !== '.avi' && extName !== '.mpg'
}
 

export class CreateDmintItemManifestsCommand implements CommandInterface {
  constructor(
    private folder: string,
    private outputName: string,
  ) {
  }
  async run(): Promise<any> {
    // Read the folder for any images
    let counter = 0;
    const files = fs.readdirSync(this.folder);
    const filemap = {};
    const leafItems: any = [];
    for (const file of files) {
      if (file.startsWith('.')) {
        console.log(`Skipping ${file}...`);
        continue;
      }
      const basePath = basename(file);
      const extName = extname(file);
      const splitBase = basePath.split('.');

      if (splitBase.length !== 2) {
        throw new Error('Image file must have exactly with dot extension: ' + basePath)
      }
      const rawName = splitBase[0];
      if (isInvalidImageExtension(extName)) {
        continue;
      }
      isValidDmitemName(rawName);
      filemap[rawName] = filemap[rawName] || {}
      const fileBuf = fs.readFileSync(this.folder + '/' + file);
      const hashed = hash256(fileBuf);
      const hashedStr = hashed.toString('hex');
      console.log(`Generating hashes for filename ${basePath} with hash ${hashedStr}`);
      const filename = 'image' + extName;
      filemap[rawName][filename] = {
        '$b': fileBuf.toString('hex')
      }
      counter++;
      const leafVector = rawName + ':' + filename + ':' + hashedStr;
      leafItems.push({
        id: rawName,
        filename,
        hashedStr,
        leafVector,
        fileBuf: fileBuf.toString('hex')
      });
    };
    const leaves = leafItems.map(x => SHA256(x.leafVector))
    const tree = new MerkleTree(leaves, SHA256)
    const root = tree.getRoot().toString('hex')

    for (const leafItem of leafItems) {
      const leaf = SHA256(leafItem.leafVector)
      const proof = tree.getProof(leaf)
      tree.verify(proof, leaf, root)
      filemap[leafItem.id]['args'] = {
        request_dmitem: leafItem.id,
        main: leafItem.filename,
        i: true // Default everything to immutable
      }
      filemap[leafItem.id]['leafVector'] = leafItem.leafVector
      filemap[leafItem.id]['hash'] = leafItem.hashedStr
      filemap[leafItem.id]['fileBuf'] = leafItem.fileBuf
    }

    const timestamp = (new Date()).getTime();
    const dirName = this.outputName + '-' + timestamp;
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName);
    }
    for (const itemProp in filemap) {
      if (!filemap.hasOwnProperty(itemProp)) {
        continue;
      }
      await jsonFileWriter(`${dirName}/item-${itemProp}.json`, {
        "mainHash": filemap[itemProp].hash,
        "data": {
          args: {
            request_dmitem: itemProp,
            main: filemap[itemProp].args.main,
            i: filemap[itemProp].args.i,
            proof: filemap[itemProp].args.proof
          },
          [filemap[itemProp].args.main]: {
            '$b': filemap[itemProp].fileBuf
          },
        }
      });
    }

    return {
      success: true,
      data: {
        folder: this.folder,
        totalItems: counter,
      }
    };
  }
}