import * as dotenv from 'dotenv'
dotenv.config(); 

export const walletPathResolver = (): string => {
  let basePath = '.';
  if (process.env.WALLET_PATH) {
    basePath = process.env.WALLET_PATH;
  }
  let fileName = 'wallet.json';
  if (process.env.WALLET_FILE) {
    fileName = process.env.WALLET_FILE;
  }
  const fullPath = `${basePath}/${fileName}`;
  return fullPath;
}
