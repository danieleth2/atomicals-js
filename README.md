# Atomicals Javascript Library

> atomicals.xyz
> Documentation: https://docs.atomicals.xyz

![Atomicals](banner.png)

### Install, Build and Run Tests

## Install

```
Download the github repo:
git clone https://github.com/atomicals/atomicals-js.git

Build:
# If you don't have yarn installed
# npm install -g yarn

yarn install
yarn run build

See all commands at:

yarn run cli --help
```

### Quick Start - Command Line (CLI)

First install packages and build, then follow the steps here to create your first Atomical and query the status. Use `yarn cli`to get a list of all commands available.

#### 0. Environment File (.env)

The environment file comes with defaults (`.env.example`), but it is highly recommend to install and operate your own ElectrumX server. Web browser communication is possible through the `wss` (secure websockets) interface of ElectrumX.

```
ELECTRUMX_WSS=wss://electrumx.atomicals.xyz:50012

// Optional (defaults to wallet.json)
WALLET_PATH=path-to-wallet.json
```

_ELECTRUMX_WSS_: URL of the ElectrumX with Atomicals support. Note that only `wss` endpoints are accessible from web browsers.

#### 1. Wallet Setup

The purpose of the wallet is to create p2tr (pay-to-taproot) spend scripts and to receive change from the transactions made for the various operations. _Do not put more funds than you can afford to lose, as this is still beta!_

To initialize a new `wallet.json` file that will store your address for receiving change use the `wallet-init` command. Alternatively, you may populate the `wallet.json` manually, ensuring that the address at `m/44'/0'/0'/0/0` is equal to the address and the derivePath is set correctly.

Configure the path in the environment `.env` file to point to your wallet file. defaults to `./wallet.json`

Default:

```
WALLET_PATH=.
WALLET_FILE=wallet.json
```

Update to `wallets/` directory:

```
WALLET_PATH=./wallets
WALLET_FILE=wallet.json
```

Create the wallet:

```
yarn cli wallet-init

>>>

Wallet created at wallet.json
phrase: maple maple maple maple maple maple maple maple maple maple maple maple
Legacy address (for change): 1FXL2CJ9nAC...u3e9Evdsa2pKrPhkag
Derive Path: m/44'/0'/0'/0/0
WIF: L5Sa65gNR6QsBjqK.....r6o4YzcqNRnJ1p4a6GPxqQQ
------------------------------------------------------
```

#### 2. Explore the CLI

```
yarn cli --help
```

#### 3. Quick Commands

Get all of the commands available:

```
yarn cli --help
```

Read the documentation at https://docs.atomicals.xyz

## ElectrumX Server RPC Interface

See updated ElectrumX (https://github.com/atomicals/atomicals-electrumx)

## Any questions or ideas?

https://atomicals.xyz

https://x.com/atomicalsxyz (X - Formerly Twitter)

## Donate to Atomicals Development

We greatly appreciate any donation to help support Atomicals Protocol development. We worked out of passion and kindness for the world, we believe this technology must exist and be free for all to use. Bitcoin is our one hope for freedom and digital sovereignty and we intend to do our best to make it a reality.

BTC: bc1pa5hvv3w3wjwfktd63zcng6yeccxg9aa90e34n9jrjw3thgc52reqxw6has

![Donate to Atomicals Development](donate.png)
# atomicals-js
