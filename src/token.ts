import {
  PublicKey,
  Account,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js"

import {
  MintLayout,
  AccountLayout,
  MintInfo,
  AccountInfo,
} from "@solana/spl-token"

import {
  Wallet,
} from "./index"

import {
  System
} from "./system"

import BufferLayout from "buffer-layout"
import { BaseProgram } from "./baseProgram"

interface InitMintParams {
  freezeAuthority?: PublicKey
  mintAuthority: PublicKey
  decimals: number

  account?: Account
}

interface InitMintInstructionParams extends InitMintParams {
  token: PublicKey
}

interface InitAccountParams {
  token: PublicKey
  owner: PublicKey

  account?: Account
}

interface InitAccountInstructionParams {
  account: PublicKey
  token: PublicKey
  owner: PublicKey
}

interface MintToParams {
  token: PublicKey
  to: PublicKey
  amount: bigint

  mintAuthority: Account
}

interface MintToInstructionParams extends MintToParams {
}

export class SPLToken extends BaseProgram {
  static programID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

  private sys: System
  constructor(wallet: Wallet, programID = SPLToken.programID) {
    super(wallet, programID)
    this.sys = new System(this.wallet)
  }

  public async mintInfo(token: PublicKey): Promise<MintInfo> {
    const info = await this.wallet.conn.getAccountInfo(token);
    if (info === null) {
      throw new Error('Failed to find mint account');
    }
    if (!info.owner.equals(this.programID)) {
      throw new Error(`Invalid mint owner: ${JSON.stringify(info.owner)}`);
    }
    if (info.data.length != MintLayout.span) {
      throw new Error(`Invalid mint size`);
    }

    const data = Buffer.from(info.data);
    const mintInfo = MintLayout.decode(data);

    if (mintInfo.mintAuthorityOption === 0) {
      mintInfo.mintAuthority = null;
    } else {
      mintInfo.mintAuthority = new PublicKey(mintInfo.mintAuthority);
    }

    mintInfo.supply = mintInfo.supply.readBigUInt64LE();
    mintInfo.isInitialized = mintInfo.isInitialized != 0;

    if (mintInfo.freezeAuthorityOption === 0) {
      mintInfo.freezeAuthority = null;
    } else {
      mintInfo.freezeAuthority = new PublicKey(mintInfo.freezeAuthority);
    }
    return mintInfo;
  }

  public async accountInfo(account: PublicKey): Promise<AccountInfo> {
    const info = await this.conn.getAccountInfo(account);
    if (info === null) {
      throw new Error('Failed to find account');
    }
    if (!info.owner.equals(this.programID)) {
      throw new Error(`Invalid account owner`);
    }
    if (info.data.length != AccountLayout.span) {
      throw new Error(`Invalid account size`);
    }

    const data = Buffer.from(info.data);
    const accountInfo = AccountLayout.decode(data);
    accountInfo.mint = new PublicKey(accountInfo.mint);
    accountInfo.owner = new PublicKey(accountInfo.owner);
    accountInfo.amount = u64FromBuffer(accountInfo.amount);

    if (accountInfo.delegateOption === 0) {
      accountInfo.delegate = null;
      accountInfo.delegatedAmount = BigInt(0);
    } else {
      accountInfo.delegate = new PublicKey(accountInfo.delegate);
      accountInfo.delegatedAmount = u64FromBuffer(accountInfo.delegatedAmount);
    }

    accountInfo.isInitialized = accountInfo.state !== 0;
    accountInfo.isFrozen = accountInfo.state === 2;

    if (accountInfo.isNativeOption === 1) {
      accountInfo.rentExemptReserve = u64FromBuffer(accountInfo.isNative);
      accountInfo.isNative = true;
    } else {
      accountInfo.rentExemptReserve = null;
      accountInfo.isNative = false;
    }

    if (accountInfo.closeAuthorityOption === 0) {
      accountInfo.closeAuthority = null;
    } else {
      accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
    }

    // if (!accountInfo.mint.equals(this.publicKey)) {
    //   throw new Error(
    //     `Invalid account mint: ${JSON.stringify(
    //       accountInfo.mint,
    //     )} !== ${JSON.stringify(this.publicKey)}`,
    //   );
    // }

    return accountInfo;
  }

  // initializeMint creates a new token with zero supply
  public async initializeMint(params: InitMintParams): Promise<Account> {
    const account = params.account || new Account()

    await this.sendTx([
      await this.sys.createRentFreeAccountInstruction({
        newPubicKey: account.publicKey,
        programID: this.programID,
        space: MintLayout.span
      }),
      this.initMintInstruction({
        token: account.publicKey,
        ...params,
      })
    ], [this.account, account])

    return account
  }

  // initializeAccount creates an account to hold token balance
  public async initializeAccount(params: InitAccountParams): Promise<Account> {
    const account = params.account || new Account()
    await this.sendTx([
      await this.sys.createRentFreeAccountInstruction({
        newPubicKey: account.publicKey,
        programID: this.programID,
        space: AccountLayout.span
      }),
      this.initAccountInstruction({
        account: account.publicKey,
        token: params.token,
        owner: params.owner,
      })
    ], [this.account, account])

    return account
  }

  public async mintTo(params: MintToParams): Promise<void> {
    await this.sendTx([
      this.mintToInstruction(params),
    ], [this.wallet.account, params.mintAuthority])
  }

  private mintToInstruction(params: MintToInstructionParams): TransactionInstruction {
    const {
      amount,
      token,
      to,
      mintAuthority,
    } = params

    const layout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
      uint64('amount'),
    ])

    return this.instruction(layout, {
      instruction: 7, // MintTo instruction
      amount: u64LEBuffer(amount),
    }, [
      { write: token },
      { write: to },
      mintAuthority, // TODO: support multisig
    ])

    // const layout = BufferLayout.struct([
    //   BufferLayout.u8('instruction'),
    //   uint64('amount'),
    // ]);

    // const data = Buffer.alloc(layout.span);
    // layout.encode(
    //   {
    //     instruction: 7, // MintTo instruction
    //     amount: u64LEBuffer(amount),
    //   },
    //   data,
    // );

    // let keys = [
    //   { pubkey: token, isSigner: false, isWritable: true },
    //   { pubkey: to, isSigner: false, isWritable: true },
    // ]

    // keys.push({
    //   pubkey: mintAuthority.publicKey,
    //   isSigner: true,
    //   isWritable: false,
    // });

    // if (authority) {
    //   keys.push({
    //     pubkey: authority,
    //     isSigner: true,
    //     isWritable: false,
    //   });
    // } else {
    // FIXME: multisig

    // keys.push({pubkey: authority, isSigner: false, isWritable: false});
    // multiSigners.forEach(signer =>
    //   keys.push({
    //     pubkey: signer.publicKey,
    //     isSigner: true,
    //     isWritable: false,
    //   }),
    // );
    // }

    // return new TransactionInstruction({
    //   keys,
    //   programId: this.programID,
    //   data,
    // });
  }

  private initMintInstruction(params: InitMintInstructionParams): TransactionInstruction {
    const layout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
      BufferLayout.u8('decimals'),
      publicKey('mintAuthority'),
      BufferLayout.u8('option'),
      publicKey('freezeAuthority'),
    ])

    return this.instruction(layout, {
      instruction: 0, // InitializeMint instruction
      decimals: params.decimals,
      mintAuthority: params.mintAuthority.toBuffer(),
      option: !params.freezeAuthority ? 0 : 1,
      freezeAuthority: (params.freezeAuthority || new PublicKey(0)).toBuffer(),
    }, [
      { write: params.token },
      SYSVAR_RENT_PUBKEY,
    ])

    // const keys = [
    //   { pubkey: params.token, isSigner: false, isWritable: true },
    //   { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    // ];

    // let data = Buffer.alloc(1024);

    // {
    //   const encodeLength = layout.encode(
    //     {
    //       instruction: 0, // InitializeMint instruction
    //       decimals: params.decimals,
    //       mintAuthority: params.mintAuthority.toBuffer(),
    //       option: !params.freezeAuthority ? 0 : 1,
    //       freezeAuthority: (params.freezeAuthority || new PublicKey(0)).toBuffer(),
    //     },
    //     data,
    //   );
    //   data = data.slice(0, encodeLength);
    // }

    // return new TransactionInstruction({
    //   keys,
    //   programId: this.programID,
    //   data,
    // });
  }

  private initAccountInstruction(params: InitAccountInstructionParams): TransactionInstruction {
    const layout = BufferLayout.struct([BufferLayout.u8('instruction')]);

    return this.instruction(layout, { instruction: 1 }, [
      { write: params.account },
      params.token,
      params.owner,
      SYSVAR_RENT_PUBKEY,
    ])

    // const keys = [
    //   { pubkey: params.account, isSigner: false, isWritable: true },
    //   { pubkey: params.token, isSigner: false, isWritable: false },
    //   { pubkey: params.owner, isSigner: false, isWritable: false },
    //   { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    // ]


    // const data = Buffer.alloc(dataLayout.span);
    // dataLayout.encode(
    //   {
    //     instruction: 1, // InitializeAccount instruction
    //   },
    //   data,
    // )

    // return new TransactionInstruction({
    //   keys,
    //   programId: this.programID,
    //   data,
    // })
  }
}

// TODO: move these to encoding utils

/**
 * Layout for a public key
 */
export const publicKey = (property: string): Object => {
  return BufferLayout.blob(32, property);
}

// /**
//  * Layout for a 64bit unsigned value
//  */
export const uint64 = (property: string = 'uint64'): Object => {
  return BufferLayout.blob(8, property);
}

export function u64FromBuffer(buf: Buffer): bigint {
  return buf.readBigUInt64LE()
}

export function u64LEBuffer(n: bigint): Buffer {
  const buf = Buffer.allocUnsafe(8)
  buf.writeBigUInt64LE(n)
  return buf
}