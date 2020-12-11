import {
  PublicKey,
  solana, Wallet, BPFLoader, SPLToken,
  ProgramAccount,
} from "soldo"

import { promises as fs } from "fs"

import { Faucet } from "./faucet"

async function deployFaucet(wallet: Wallet) {
  const bpfLoader = new BPFLoader(wallet)

  const soPath = "/home/tron/example-helloworld/src/program-rust/target/bpfel-unknown-unknown/release/solana_bpf_helloworld.so"
  const soData = await fs.readFile(soPath)
  console.log("program size:", soData.length)
  const program = await bpfLoader.load(soData)
  console.log("deployed to:", program.publicKey.toString())
}

async function main() {
  const master = {
    mnemonic: 'control bulk thing never memory turn toss mass just youth ginger spot',
    seed: '65ec16a63ef5cbc0d1e5604a4ac04671c6c55f6dccfe841263ea6ec2b1af147d79636f65336aea58e71d03f620a00d579601b11256e5735235ee4e2b1ca4b68a'
  }

  const conn = solana.connect("dev")
  const wallet = await Wallet.fromMnemonic(master.mnemonic, conn)

  console.log("using wallet", wallet.address)
  // console.log(wallet, await wallet.info())

  // for (let i = 0; i < 11; i++) {
  //   let account = wallet.deriveAccount(`${i}`)
  //   console.log(i, account.publicKey.toString())
  // }

  const facuetPubkey = new PublicKey("9jpPoiHzs2ug2nGzzXTVjc8pQL14LgbcCt9n7avQU6e1")

  // I don't like the "Token" name. Kinda awkward to distinguish between token instances.
  const spltoken = new SPLToken(wallet)

  // const token = await spltoken.initializeMint({
  //   mintAuthority: wallet.account.publicKey,
  //   decimals: 8,
  // })
  // const tokenPubkey = token.publicKey
  // console.log({ mintPubkey: tokenPubkey.toString() })

  const tokenPubkey = new PublicKey("9PGzvRMriijtGcTNkgkShdqw6CFy9eQAySZUJ5je4Gx4")
  // const mintInfo = await spltoken.mintInfo(tokenPubkey)
  // console.log("mint authority", mintInfo.mintAuthority?.toBase58())


  const faucetTokenOwner = await ProgramAccount.forSeed(Buffer.from("deadbeaf", "hex"), facuetPubkey)
  console.log("faucet token owner", {
    address: faucetTokenOwner.address,
    seed: faucetTokenOwner.noncedSeed.toString("hex"),
    nonce: faucetTokenOwner.nonce,
  })

  // The trick to create a program token account is to create a normal token account
  // (we can throw away the secret key), and set the token account's owner to the
  // program account address (which the program can sign with a seed).
  //
  // See: https://docs.solana.com/implemented-proposals/program-derived-addresses
  // Also See: https://docs.solana.com/implemented-proposals/cross-program-invocation
  //
  // const faucetTokenAccount = await spltoken.initializeAccount({
  //   token: mintedTokenPubkey,
  //   owner: faucetTokenAuthority.pubkey
  // })
  // const faucetTokenAccountPubkey = faucetTokenAccount.publicKey
  // console.log({ faucetTokenAccountPubkey: faucetTokenAccountPubkey.toString() })

  const faucetTokenAccountPubkey = new PublicKey("Cb6cwE2sE4FRmLDpo3EbkZozcyvFfiDEfDdVavE84QYg")
  let tokenAccountInfo = await spltoken.accountInfo(faucetTokenAccountPubkey)
  console.log("tokenAccountInfo", {
    address: faucetTokenAccountPubkey.toBase58(),
    owner: tokenAccountInfo.owner.toString(),
    mint: tokenAccountInfo.mint.toString(),
  })

  // await spltoken.mintTo({
  //   token: tokenPubkey,
  //   to: faucetTokenAccountPubkey,
  //   amount: BigInt(10000e8),
  //   mintAuthority: wallet.account,
  // })

  const receiver = wallet.derive("1'/0")
  console.log("receiver", receiver.address) // 6KHLWpARme9NZy8tohj5D3XHhStBeVcHknCyk7CJRQiy
  // await spltoken.initializeAccount({
  //   token: tokenPubkey,
  //   owner: wallet.pubkey,
  //   account: receiver.account,
  // })
  tokenAccountInfo = await spltoken.accountInfo(receiver.pubkey)
  console.log("receiver token account", {
    address: receiver.address,
    owner: tokenAccountInfo.owner.toString(),
    mint: tokenAccountInfo.mint.toString(),
  })

  const faucet = new Faucet(wallet, facuetPubkey)
  await faucet.request({
    receiver: receiver.pubkey,
    tokenAccount: faucetTokenAccountPubkey,
    tokenOwner: faucetTokenOwner,
  })


  // hmmm... it's very very strange that 2 tokens had been transfered
  // oh what? it works now?

  // TODO: fix: BPF program 9jpPoiHzs2ug2nGzzXTVjc8pQL14LgbcCt9n7avQU6e1 failed: Cross-program invocation with unauthorized signer or writable account

  // TODO: idempotent "spltoken.ensureAccount". check that owner and token are as expected
  // TODO: create a token account to receive from faucet
  // TODO: invoke faucet


  // TODO: save created accounts in file
  // const trail = new PaperTrail(filepath)
  // // it records account keypair under the key "faucet"
  // trail.create("faucet", () => {
  //   return deployFaucet(wallet)
  // })

  // trail.create("token", () => {
  //   return mintToken(wallet)
  // })


  // TODO get token account info
  // TODO support for spltoken multisig -.-

  // Note: it's ok to not keep the keypairs of "memory storage" accounts

}

main().catch(err => console.log({ err }))
