// spl token faucet

import {
  PublicKey,
  BaseProgram,
  ProgramAccount,
  SPLToken,
} from "soldo"

interface RequestParams {
  receiver: PublicKey
  tokenAccount: PublicKey
  tokenOwner: ProgramAccount
}

export class Faucet extends BaseProgram {
  public async request(params: RequestParams) {
    return this.sendTx([
      this.requestInstruction(params)
    ], [this.account])
  }

  private requestInstruction(params: RequestParams) {
    const data = params.tokenOwner.noncedSeed

    return this.instruction(data, [
      { write: params.receiver },
      SPLToken.programID,
      { write: params.tokenAccount },
      params.tokenOwner.pubkey,
    ])
  }
}