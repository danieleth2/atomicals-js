

import * as fs from 'fs';
 
import { JsonStreamStringify } from 'json-stream-stringify';

export const fileReader = async (filePath, encoding?: any) => {
	return new Promise((resolve, reject) => {
		fs.readFile(filePath, encoding, (err, fileData: any) => {
			if (err) {
				console.log(`Error reading ${filePath}`, err);
				return reject(err);
			}
			try {
				return resolve(fileData);
			} catch (err) {
				console.log(`Error reading ${filePath}`, err);
				return reject(null);
			}
		})
	});
}

export const jsonFileReader = async (filePath) => {
	return new Promise((resolve, reject) => {
		fs.readFile(filePath, (err, fileData: any) => {
			if (err) {
				console.log(`Error reading ${filePath}`, err);
				return reject(err);
			}
			try {
				const object = JSON.parse(fileData)
				return resolve(object);
			} catch (err) {
				console.log(`Error reading ${filePath}`, err);
				return reject(null);
			}
		})
	});
}

export const jsonFileWriter = async (filePath, data) => {
	return new Promise(function (resolve, reject) {
		fs.writeFile(filePath, Buffer.from(JSON.stringify(data,null, 2)), 'utf8', function (err) {
			if (err) {
				console.log('jsonFileWriter', err);
				reject(err);
			}
			else {

				resolve(true);
			}
		});
	})
};

/*

export const jsonFileWriter = async (filePath, data) => {

	return new Promise(function (resolve, reject) {
		const stringifyStream = json.createStringifyStream({
			body: data
		});
		var fd = fs.openSync(filePath, 'w');

		fs.closeSync(fs.openSync(filePath, 'w'));

		stringifyStream.on('data', function (strChunk) {
			fs.appendFile(filePath, strChunk, function (err) {
				if (err) throw err;
			})
		});
		stringifyStream.on('end', function () {
			resolve(true);
		})
	});

};

const json = require('big-json');
 
// pojo will be sent out in JSON chunks written to the specified file name in the root 
function makeFile(filename, pojo){

    const stringifyStream = json.createStringifyStream({
        body: pojo
    });

    stringifyStream.on('data', function(strChunk) {
        fs.appendFile(filename, strChunk, function (err) {
            if (err) throw err;
        })
    });

}

*/

export const fileWriter = async (filePath, data) => {
	return new Promise(function (resolve, reject) {
		fs.writeFile(filePath, data, 'utf8', function (err) {
			if (err) {
				console.log('fileWriter', err);
				reject(err);
			}
			else {
				resolve(true);
			}
		});
	})
};

export const jsonFileExists = async (filePath) => {
	return new Promise(function (resolve, reject) {
		fs.exists(filePath, function (exists) {
			resolve(exists);
		});
	})
};


export function chunkBuffer(buffer: any, chunkSize: number) {
	assert(!isNaN(chunkSize) && chunkSize > 0, 'Chunk size should be positive number');
	const result: any = [];
	const len = buffer.byteLength;
	let i = 0;
	while (i < len) {
		result.push(buffer.slice(i, i += chunkSize));
	}
	return result;
}

function assert(cond, err) {
	if (!cond) {
		throw new Error(err);
	}
}

