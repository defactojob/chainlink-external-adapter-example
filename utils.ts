import {
  PublicKey,
  Connection,
  Account,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js"

interface KeyPair {
  pubkey: string // base58
  secret: string // hex
}

const payerSecret = Buffer.from("234e80635e070d0186635a6633ea51bf5e20efd7b79c9fc21bb7e1485bc86eb5578a1069186d2450849d31adc71976a4f11217cb12e96b1d4df5a4199c57dab4", "hex")
export const payer = new Account(payerSecret)

const url = 'http://localhost:8899'
export const connection = new Connection(url, 'singleGossip');

const oneSolanaInLamport = 1e9 // lamport

export async function requestAirdrop(pubkey: PublicKey, amount: number) {
  // const key = new PublicKey(pubkey)

  return await connection.requestAirdrop(pubkey, amount * oneSolanaInLamport)
}

export async function generateProgramAccount(programId: PublicKey, space: number = 0): Promise<Account> {
  // Q: can i DOS by creating a shiton of accounts w/o space? lol...
  // A: no. there is a min account size (128 bytes). Also need tx fee.

  const programAccount = new Account()

  const exemptBalance = await connection.getMinimumBalanceForRentExemption(
    space,
  )

  const createAccount = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: programAccount.publicKey,
    lamports: exemptBalance,
    space,
    programId,
  })

  const tx = new Transaction()
  tx.add(createAccount)

  const txid = await sendAndConfirmTransaction(
    connection,
    tx,
    [payer, programAccount],
    {
      commitment: 'singleGossip',
      preflightCommitment: 'singleGossip',
    },
  )

  return programAccount
}

export function generateKeyPair() {
  const account = new Account()

  return accountKeyPair(account)
}

export function accountFromHexSecret(hexsecret: string): Account {
  return new Account(Buffer.from(hexsecret, "hex"))
}

export function accountKeyPair(account: Account): KeyPair {
  return {
    pubkey: account.publicKey.toBase58(),
    secret: Buffer.from(account.secretKey).toString("hex"),
  }
}