import {
  Account,
  Connection,
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
} from "@solana/web3.js"

export { Wallet } from "./wallet"
export { SPLToken } from "./token"
export { ProgramAccount } from "./programAccount"
export { BaseProgram } from "./baseProgram"

export namespace solana {
  export function connect(networkName: string, opts: { commitment?: string } = {}): Connection {
    const commitment = opts.commitment || "singleGossip"

    switch (networkName) {
      case "devnet":
      case "dev":
        return new Connection("https://devnet.solana.com", commitment as any)
      default:
        throw new Error(`Unknown network to connect to: ${networkName}`)
    }
  }
}

import { Wallet } from "./wallet"
export class BPFLoader {
  static programID = BPF_LOADER_PROGRAM_ID

  constructor(private wallet: Wallet, public programID = BPFLoader.programID) {}

  public async load(programBinary: Buffer, programAccount = new Account()): Promise<Account> {
    await BpfLoader.load(
      this.wallet.conn,
      this.wallet.account,
      programAccount,
      programBinary,
      this.programID,
    )

    return programAccount
  }
}
