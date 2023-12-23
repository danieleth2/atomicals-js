import { parentPort } from "worker_threads";
import { KeyPairInfo, getKeypairInfo } from "./address-keypair-path";
import { script, payments } from "bitcoinjs-lib";
import { BitworkInfo, hasValidBitwork } from "./atomical-format-helpers";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from "ecpair";

const tinysecp: TinySecp256k1Interface = require("tiny-secp256k1");
const bitcoin = require("bitcoinjs-lib");
import * as chalk from "chalk";

bitcoin.initEccLib(ecc);
import { initEccLib, networks, Psbt } from "bitcoinjs-lib";

initEccLib(tinysecp as any);
import {
    AtomicalsPayload,
    NETWORK,
    RBF_INPUT_SEQUENCE,
} from "../commands/command-helpers";
import {
    AtomicalOperationBuilderOptions,
    DUST_AMOUNT,
    EXCESSIVE_FEE_LIMIT,
    FeeCalculations,
    OUTPUT_BYTES_BASE,
} from "./atomical-operation-builder";
import { Worker } from "worker_threads";
import { ATOMICALS_PROTOCOL_ENVELOPE_ID } from "../types/protocol-tags";
import { chunkBuffer } from "./file-utils";

const ECPair: ECPairAPI = ECPairFactory(tinysecp);

interface WorkerInput {
    copiedData: AtomicalsPayload;
    nonceStart: any;
    nonceEnd: any;
    workerOptions: AtomicalOperationBuilderOptions;
    fundingWIF: string;
    fundingUtxo: any;
    fees: FeeCalculations;
    performBitworkForCommitTx: boolean;
    workerBitworkInfoCommit: BitworkInfo;
    iscriptP2TR: any;
    ihashLockP2TR: any;
}

// This is the worker's message event listener
if (parentPort) {
    parentPort.on("message", async (message: WorkerInput) => {
        // Destructuring relevant data from the message object
        const {
            copiedData,
            nonceStart,
            nonceEnd,
            workerOptions,
            fundingWIF,
            fundingUtxo,
            fees,
            performBitworkForCommitTx,
            workerBitworkInfoCommit,
            iscriptP2TR,
            ihashLockP2TR,
        } = message;

        // Initialize worker-specific variables
        let workerNonce = nonceStart;
        let workerNoncesGenerated = nonceStart;
        let workerPerformBitworkForCommitTx = performBitworkForCommitTx;
        let scriptP2TR = iscriptP2TR;
        let hashLockP2TR = ihashLockP2TR;

        // Convert the WIF (Wallet Import Format) to a keypair
        const fundingKeypairRaw = ECPair.fromWIF(fundingWIF);
        const fundingKeypair = getKeypairInfo(fundingKeypairRaw);

        // Variables to hold final results
        let finalCopyData;
        let finalPrelimTx;
        let finalBaseCommit;

        // Record current Unix time
        let unixtime = Math.floor(Date.now() / 1000);
        copiedData["args"]["time"] = unixtime;

        // Start mining loop, terminates when a valid proof of work is found or stopped manually
        do {
            // Introduce a minor delay to avoid overloading the CPU
            await sleep(0); // Changed from 1 second for a non-blocking wait

            // Set nonce and timestamp in the data to be committed
            copiedData["args"]["nonce"] = workerNonce;
            if (workerNoncesGenerated % 5000 == 0) {
                unixtime = Math.floor(Date.now() / 1000);
                copiedData["args"]["time"] = unixtime;
                workerNonce =
                    Math.floor(Math.random() * (nonceEnd - nonceStart + 1)) +
                    nonceStart;
            } else {
                workerNonce++;
            }

            // Create a new atomic payload instance
            const atomPayload = new AtomicalsPayload(copiedData);

            // Prepare commit and reveal configurations
            const updatedBaseCommit: { scriptP2TR; hashLockP2TR; hashscript } =
                workerPrepareCommitRevealConfig(
                    workerOptions.opType,
                    fundingKeypair,
                    atomPayload
                );

            // Create a new PSBT (Partially Signed Bitcoin Transaction)
            let psbtStart = new Psbt({ network: NETWORK });
            psbtStart.setVersion(1);

            // Add input and output to PSBT
            psbtStart.addInput({
                hash: fundingUtxo.txid,
                index: fundingUtxo.index,
                sequence: workerOptions.rbf ? RBF_INPUT_SEQUENCE : undefined,
                tapInternalKey: Buffer.from(
                    fundingKeypair.childNodeXOnlyPubkey as number[]
                ),
                witnessUtxo: {
                    value: fundingUtxo.value,
                    script: Buffer.from(fundingKeypair.output, "hex"),
                },
            });
            psbtStart.addOutput({
                address: updatedBaseCommit.scriptP2TR.address,
                value: getOutputValueForCommit(fees),
            });

            // Add change output if required
            addCommitChangeOutputIfRequired(
                fundingUtxo.value,
                fees,
                psbtStart,
                fundingKeypair.address,
                workerOptions.satsbyte
            );

            psbtStart.signInput(0, fundingKeypair.tweakedChildNode);
            psbtStart.finalizeAllInputs();

            // Extract the transaction and get its ID
            let prelimTx = psbtStart.extractTransaction();
            const checkTxid = prelimTx.getId();

            logMiningProgressToConsole(
                workerPerformBitworkForCommitTx,
                workerOptions.disableMiningChalk,
                checkTxid,
                workerNoncesGenerated
            );
            // Check if there is a valid proof of work
            if (
                workerPerformBitworkForCommitTx &&
                hasValidBitwork(
                    checkTxid,
                    workerBitworkInfoCommit?.prefix as any,
                    workerBitworkInfoCommit?.ext as any
                )
            ) {
                // Valid proof of work found, log success message

                console.log(
                    chalk.green(
                        checkTxid,
                        ` nonces: ${workerNoncesGenerated} (${workerNonce})`
                    )
                );
                console.log(
                    "\nBitwork matches commit txid! ",
                    prelimTx.getId(),
                    `@ time: ${unixtime}`
                );

                // Set final results

                finalCopyData = copiedData;
                finalPrelimTx = prelimTx;
                finalBaseCommit = updatedBaseCommit;
                workerPerformBitworkForCommitTx = false;
            }

            workerNoncesGenerated++;
        } while (workerPerformBitworkForCommitTx);

        // send a result or message back to the main thread
        console.log("got one finalCopyData:" + JSON.stringify(finalCopyData));
        console.log("got one finalPrelimTx:" + JSON.stringify(finalPrelimTx));
        parentPort!.postMessage({
            finalCopyData,
            finalPrelimTx,
            finalBaseCommit,
        });
    });
}

function logMiningProgressToConsole(
    dowork: boolean,
    disableMiningChalk,
    txid,
    nonces
) {
    if (!dowork) {
        return;
    }
    console.log(chalk.red(txid, " nonces: ", nonces));
}

function getOutputValueForCommit(fees: FeeCalculations): number {
    let sum = 0;
    // Note that `Additional inputs` refers to the additional inputs in a reveal tx.
    return fees.revealFeePlusOutputs - sum;
}

function addCommitChangeOutputIfRequired(
    extraInputValue: number,
    fee: FeeCalculations,
    pbst: any,
    address: string,
    satsbyte: any
) {
    const totalInputsValue = extraInputValue;
    const totalOutputsValue = getOutputValueForCommit(fee);
    const calculatedFee = totalInputsValue - totalOutputsValue;
    // It will be invalid, but at least we know we don't need to add change
    if (calculatedFee <= 0) {
        return;
    }
    // In order to keep the fee-rate unchanged, we should add extra fee for the new added change output.
    const expectedFee =
        fee.commitFeeOnly + (satsbyte as any) * OUTPUT_BYTES_BASE;
    // console.log('expectedFee', expectedFee);
    const differenceBetweenCalculatedAndExpected = calculatedFee - expectedFee;
    if (differenceBetweenCalculatedAndExpected <= 0) {
        return;
    }
    // There were some excess satoshis, but let's verify that it meets the dust threshold to make change
    if (differenceBetweenCalculatedAndExpected >= DUST_AMOUNT) {
        pbst.addOutput({
            address: address,
            value: differenceBetweenCalculatedAndExpected,
        });
    }
}

export const workerPrepareCommitRevealConfig = (
    opType:
        | "nft"
        | "ft"
        | "dft"
        | "dmt"
        | "sl"
        | "x"
        | "y"
        | "mod"
        | "evt"
        | "dat",
    keypair: KeyPairInfo,
    atomicalsPayload: AtomicalsPayload,
    log = true
) => {
    const revealScript = appendMintUpdateRevealScript(
        opType,
        keypair,
        atomicalsPayload,
        log
    );
    const hashscript = script.fromASM(revealScript);
    const scriptTree = {
        output: hashscript,
    };
    const hash_lock_script = hashscript;
    const hashLockRedeem = {
        output: hash_lock_script,
        redeemVersion: 192,
    };
    const buffer = Buffer.from(keypair.childNodeXOnlyPubkey);
    const scriptP2TR = payments.p2tr({
        internalPubkey: buffer,
        scriptTree,
        network: NETWORK,
    });

    const hashLockP2TR = payments.p2tr({
        internalPubkey: buffer,
        scriptTree,
        redeem: hashLockRedeem,
        network: NETWORK,
    });
    return {
        scriptP2TR,
        hashLockP2TR,
        hashscript,
    };
};

export const appendMintUpdateRevealScript = (
    opType:
        | "nft"
        | "ft"
        | "dft"
        | "dmt"
        | "sl"
        | "x"
        | "y"
        | "mod"
        | "evt"
        | "dat",
    keypair: KeyPairInfo,
    payload: AtomicalsPayload,
    log: boolean = true
) => {
    let ops = `${Buffer.from(keypair.childNodeXOnlyPubkey, "utf8").toString(
        "hex"
    )} OP_CHECKSIG OP_0 OP_IF `;
    ops += `${Buffer.from(ATOMICALS_PROTOCOL_ENVELOPE_ID, "utf8").toString(
        "hex"
    )}`;
    ops += ` ${Buffer.from(opType, "utf8").toString("hex")}`;
    const chunks = chunkBuffer(payload.cbor(), 520);
    for (let chunk of chunks) {
        ops += ` ${chunk.toString("hex")}`;
    }
    ops += ` OP_ENDIF`;
    return ops;
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
