
import { Account, PublicKey } from "@solana/web3.js"

import {
  generateKeyPair,
  requestAirdrop,
  connection,
  generateProgramAccount,
  accountKeyPair,
  accountFromHexSecret,
} from "./utils"

const programId = new PublicKey("FpWDVR4Df1o7NK7i3Vc7UutaTtxanJpRNgiaesVwDM5L")

// program account:
// abe6eae8dd8c8049df28efdeb6dd456c469450f090313190379376de066e78dcb1106d4c29063f991c8580df8a56bb467f6fcc7678a5a3f1e82c0e3e4c36348a

const payer = accountFromHexSecret("234e80635e070d0186635a6633ea51bf5e20efd7b79c9fc21bb7e1485bc86eb5578a1069186d2450849d31adc71976a4f11217cb12e96b1d4df5a4199c57dab4")

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function main() {
  console.log(generateKeyPair())

  // console.log(await requestAirdrop(payer, 10))

  // if i send an public address some solana, the owner of that account is 0

  console.log("info", await connection.getAccountInfo(payer.publicKey))
  console.log("balance", await connection.getBalance(payer.publicKey))

  // returns null
  // console.log("info 2", await connection.getAccountInfo(new PublicKey("9jaDqpv4YMkDqR5tfcxEnT2Dm7oPSCeJDcj24L8L73JU")))


  for (let i = 0; i < 16; i++) {
    const size = i == 0 ? 0 : 2**i
    const minBalance = await connection.getMinimumBalanceForRentExemption(size)

    console.log(`exempt balance bytes=${size}: ${minBalance/1e9}`)
  }

  // {
  //   pubkey: 'CvBh46cSS4odS7cfyphfZrzBzwB5aMQYhdLbogMfbMyT',
  //   secret: 'abe6eae8dd8c8049df28efdeb6dd456c469450f090313190379376de066e78dcb1106d4c29063f991c8580df8a56bb467f6fcc7678a5a3f1e82c0e3e4c36348a'
  // }

  // const programAccount = await generateProgramAccount(programId, 4)

  // Account.fromHex(...)

  // CvBh46cSS4odS7cfyphfZrzBzwB5aMQYhdLbogMfbMyT
  const programAccount = accountFromHexSecret("abe6eae8dd8c8049df28efdeb6dd456c469450f090313190379376de066e78dcb1106d4c29063f991c8580df8a56bb467f6fcc7678a5a3f1e82c0e3e4c36348a")
  console.log("program account:", accountKeyPair(programAccount))

  while (true) {
    const info = await connection.getAccountInfo(programAccount.publicKey)
    console.log("btc usdt on solana:", info?.data.readUInt32LE())
    await sleep(1000)
  }




}

main().catch(err => console.log("err", err))