import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as cloneDeep from 'lodash.clonedeep';
import { buildAtomicalsFileMapFromRawTx, getTxIdFromAtomicalId, hexifyObjectWithUtf8 } from "../utils/atomical-format-helpers";
import { fileWriter, jsonFileWriter } from "../utils/file-utils";
import * as fs from 'fs';
import * as mime from 'mime-types';
import { FileMap } from "../interfaces/filemap.interface";

export const writeFiles = async (inputIndexToFilesMap: any, txDir: string): Promise<FileMap> => {
  const fileSummary = {};
  for (const inputIndex in inputIndexToFilesMap) {
    if (!inputIndexToFilesMap.hasOwnProperty(inputIndex)) {
      continue;
    }
    const inputTxDir = txDir + `/${inputIndex}`;
    if (!fs.existsSync(inputTxDir)) {
      fs.mkdirSync(inputTxDir);
    }
    fileSummary[inputIndex] = {
      directory: inputTxDir,
      files: {}
    }
    const rawdata = inputIndexToFilesMap[inputIndex].rawdata;
    const rawdataPath = inputTxDir + `/_rawdata.hex`
    await fileWriter(rawdataPath, rawdata.toString('hex'));
    const decoded = inputIndexToFilesMap[inputIndex]['decoded'];
    const fulldecodedPath = inputTxDir + `/_rawdata.json`;
    const objectDecoded = Object.assign({}, {}, decoded);
    const copiedObjectDecoded = cloneDeep(objectDecoded);
    await fileWriter(fulldecodedPath, JSON.stringify(hexifyObjectWithUtf8(copiedObjectDecoded, false), null, 2));
    if (decoded) {
      for (const filename in decoded) {
        if (!decoded.hasOwnProperty(filename)) {
          continue;
        }
        const fileEntry = decoded[filename];
        if (fileEntry['$ct'] && fileEntry['$b']) {
          const contentType = fileEntry['$ct'];
          const detectedExtension = mime.extension(contentType) || '.dat';
          let fileNameWithExtension = `${filename}.${detectedExtension}`;
          const fullPath = inputTxDir + `/${fileNameWithExtension}`
          /* if (/utf8/.test(contentType)) {
            await fileWriter(fullPath, fileEntry['d']);
          } else {
          }*/
          await fileWriter(fullPath, fileEntry['$b']);
          const contentLength = fileEntry['$b'].length;
          const body = fileEntry['$b'];
          fileSummary[inputIndex]['files'][filename] = {
            filename,
            fileNameWithExtension,
            detectedExtension,
            fullPath,
            contentType,
            contentLength,
            body: body.toString('hex')
          }
        } else if (fileEntry['$b']) {
          // when there is not explicit content type with 'ct' then assume it is json
          const contentType = 'application/json'
          const fileNameWithExtension = `${filename}.property.json`;
          const fullPath = inputTxDir + `/${fileNameWithExtension}`
          await fileWriter(fullPath, JSON.stringify(fileEntry, null, 2));
          const contentLength = fileEntry['$b'].length;
          const body = fileEntry['$b'];
          fileSummary[inputIndex]['files'][filename] = {
            filename,
            fileNameWithExtension,
            detectedExtension: '.json',
            fullPath,
            contentType,
            contentLength,
            body: body.toString('hex')
          }
        } else {
          // when there is not explicit content type with 'ct' then assume it is json
          const contentType = 'application/json'
          const fileNameWithExtension = `${filename}.property.json`;
          const fullPath = inputTxDir + `/${fileNameWithExtension}`
          await fileWriter(fullPath, JSON.stringify(fileEntry, null, 2));
          const contentLength = fileEntry.length;
          const body = fileEntry 
          fileSummary[inputIndex]['files'][filename] = {
            filename,
            fileNameWithExtension,
            detectedExtension: '.json',
            fullPath,
            contentType,
            contentLength,
            body: body
          }
        }
      }
    }
  }
  await jsonFileWriter(txDir + '/manifest.json', fileSummary);
  return fileSummary;
}
export class DownloadCommand implements CommandInterface {
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private atomicalIdOrTxId: string,
  ) {
  }
  async run(): Promise<any> {
    const txid = getTxIdFromAtomicalId(this.atomicalIdOrTxId);
    const txResult = await this.electrumApi.getTx(txid, false);

    if (!txResult || !txResult.success) {
      throw `transaction not found ${txid}`;
    }
    const tx = txResult.tx;
    const downloadDir = `download_txs/`;
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }
    const txDir = `${downloadDir}/${txid}`;
    if (!fs.existsSync(txDir)) {
      fs.mkdirSync(txDir);
    }
    await fileWriter(txDir + `/${txid}.hex`, tx)
    const filemap = buildAtomicalsFileMapFromRawTx(tx, false, false)
    const writeResult = await writeFiles(filemap, txDir);
    return {
      success: true,
      data: {
        txid,
        filemap: writeResult
      }
    };
  }
}