import {
  Connection,
  PublicKey,
  Account,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSTEM_INSTRUCTION_LAYOUTS,
} from "@solana/web3.js"

import {
  MintLayout,
  AccountLayout,
} from "@solana/spl-token"

// import {
//   Layout,
// } from "@solana/spl-token/layout"

import BufferLayout from "buffer-layout"

export const SPL_TOKEN_PROGRM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

async function getMinBalanceRentForExempt(
  connection: Connection,
  size: number,
): Promise<number> {
  return await connection.getMinimumBalanceForRentExemption(size);
}

function createMintToInstruction(
  programId: PublicKey,
  mint: PublicKey,
  dest: PublicKey,
  authority: PublicKey | null,
  multiSigners: Account[] | null,
  amount: bigint,
): TransactionInstruction {
  const dataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    uint64('amount'),
  ]);

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 7, // MintTo instruction
      amount: u64LEBuffer(amount),
    },
    data,
  );

  let keys = [
    {pubkey: mint, isSigner: false, isWritable: true},
    {pubkey: dest, isSigner: false, isWritable: true},
  ];
  if (authority) {
    keys.push({
      pubkey: authority,
      isSigner: true,
      isWritable: false,
    });
  } else {
    // FIXME: multisig

    // keys.push({pubkey: authority, isSigner: false, isWritable: false});
    // multiSigners.forEach(signer =>
    //   keys.push({
    //     pubkey: signer.publicKey,
    //     isSigner: true,
    //     isWritable: false,
    //   }),
    // );
  }

  return new TransactionInstruction({
    keys,
    programId: programId,
    data,
  });
}

function createInitAccountInstruction(
  programId: PublicKey,
  mint: PublicKey,
  account: PublicKey,
  owner: PublicKey,
): TransactionInstruction {
  const keys = [
    {pubkey: account, isSigner: false, isWritable: true},
    {pubkey: mint, isSigner: false, isWritable: false},
    {pubkey: owner, isSigner: false, isWritable: false},
    {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
  ];
  const dataLayout = BufferLayout.struct([BufferLayout.u8('instruction')]);
  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 1, // InitializeAccount instruction
    },
    data,
  );

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
}

export interface InstructionType {
  index: number,
  layout: BufferLayout,
}

export interface CreateAccountParams {
  fromPubkey: PublicKey,
  newAccountPubkey: PublicKey,
  lamports: number,
  space: number,
  programId: PublicKey,
}

export function encodeData(type: InstructionType, fields: Object): Buffer {
  const allocLength =
    type.layout.span >= 0 ? type.layout.span : 0;
  const data = Buffer.alloc(allocLength);
  const layoutFields = Object.assign({instruction: type.index}, fields);
  type.layout.encode(layoutFields, data);
  return data;
}

function createAccount(params: CreateAccountParams): TransactionInstruction {
  const type = SYSTEM_INSTRUCTION_LAYOUTS.Create;
  const data = encodeData(type, {
    lamports: params.lamports,
    space: params.space,
    programId: params.programId.toBuffer(),
  });

  // do you need the second account to be signed..?

  return new TransactionInstruction({
    keys: [
      {pubkey: params.fromPubkey, isSigner: true, isWritable: true},
      {pubkey: params.newAccountPubkey, isSigner: false, isWritable: true},
    ],
    programId: SystemProgram.programId,
    data,
  });
}

export class Token {
  constructor (private connection: Connection, private publicKey: PublicKey, private payer: Account, private programId = SPL_TOKEN_PROGRM_ID) {}

  async createAccount(newAccount: Account, owner: PublicKey): Promise<PublicKey> {
    // Allocate memory for the account
    const balanceNeeded = await getMinBalanceRentForExempt(
      this.connection,
      AccountLayout.span,
    );

    // const newAccount = new Account();
    const transaction = new Transaction();

    const info = await this.connection.getAccountInfo(newAccount.publicKey)
    if (!info) {
      transaction.add(
        // SystemProgram.createAccount({
        createAccount({
          fromPubkey: this.payer.publicKey,
          newAccountPubkey: newAccount.publicKey,
          lamports: balanceNeeded,
          space: AccountLayout.span,
          programId: this.programId,
        }),
      );
    }

    const mintPublicKey = this.publicKey;
    transaction.add(
      createInitAccountInstruction(
        this.programId,
        mintPublicKey,
        newAccount.publicKey,
        owner,
      ),
    );

    // Send the two instructions
    await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer, newAccount]
    );

    return newAccount.publicKey;
  }

  public async mintTo(
    dest: PublicKey,
    authority: Account | null,
    multiSigners: Account[] | null,
    amount: bigint,
  ): Promise<void> {
    let ownerPublicKey;
    let signers;
    if (authority) {
      ownerPublicKey = authority.publicKey;
      signers = [authority];
    } else {
      ownerPublicKey = authority;
      signers = multiSigners;
    }
    await sendAndConfirmTransaction(
      this.connection,
      new Transaction().add(
        createMintToInstruction(
          SPL_TOKEN_PROGRM_ID,
          this.publicKey,
          dest,
          ownerPublicKey,
          multiSigners,
          amount,
        ),
      ),
      [this.payer, ...signers],
    );
  }
}

export class Mint {

  constructor (private connection: Connection, private payer: Account) {}

  public async info(mintAccount: PublicKey): Promise<MintInfo> {
    const info = await this.connection.getAccountInfo(mintAccount);
    if (info === null) {
      throw new Error('Failed to find mint account');
    }
    if (!info.owner.equals(SPL_TOKEN_PROGRM_ID)) {
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



  public async createMint(
    mintAccount: Account,
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey | null,
    decimals: number,
  ) {
    const programId = SPL_TOKEN_PROGRM_ID

    const {
      connection,
      payer,
    } = this

    // Allocate memory for the account
    const balanceNeeded = await getMinBalanceRentForExempt(
      connection,
      MintLayout.span,
    );

    const transaction = new Transaction();

    const info = await this.connection.getAccountInfo(mintAccount.publicKey)

    if (info == null) {
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintAccount.publicKey,
          lamports: balanceNeeded,
          space: MintLayout.span,
          programId,
        }),
      )
    }

    transaction.add(
      this.createInitMintInstruction(
        programId,
        mintAccount.publicKey,
        decimals,
        mintAuthority,
        freezeAuthority,
      ),
    )

    // Send the two instructions
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintAccount], // mintAccount // i don't think it needs signature from mintAccount...
    )
  }

  public createInitMintInstruction(
    programId: PublicKey,
    mint: PublicKey,
    decimals: number,
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey | null,
  ): TransactionInstruction {
    const keys = [
      {pubkey: mint, isSigner: false, isWritable: true},
      {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
    ];

    const commandDataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
      BufferLayout.u8('decimals'),
      publicKey('mintAuthority'),
      BufferLayout.u8('option'),
      publicKey('freezeAuthority'),
    ]);

    let data = Buffer.alloc(1024);

    {
      const encodeLength = commandDataLayout.encode(
        {
          instruction: 0, // InitializeMint instruction
          decimals,
          mintAuthority: mintAuthority.toBuffer(),
          option: freezeAuthority === null ? 0 : 1,
          freezeAuthority: (freezeAuthority || new PublicKey(0)).toBuffer(),
        },
        data,
      );
      data = data.slice(0, encodeLength);
    }

    return new TransactionInstruction({
      keys,
      programId,
      data,
    });
  }
}

/**
 * Layout for a public key
 */
export const publicKey = (property: string): Object => {
  return BufferLayout.blob(32, property);
};

// /**
//  * Layout for a 64bit unsigned value
//  */
export const uint64 = (property: string = 'uint64'): Object => {
  return BufferLayout.blob(8, property);
};

// /**
//  * Layout for a Rust String type
//  */
// export const rustString = (property: string = 'string'): Object => {
//   const rsl = BufferLayout.struct(
//     [
//       BufferLayout.u32('length'),
//       BufferLayout.u32('lengthPadding'),
//       BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars'),
//     ],
//     property,
//   );
//   const _decode = rsl.decode.bind(rsl);
//   const _encode = rsl.encode.bind(rsl);

//   rsl.decode = (buffer, offset) => {
//     const data = _decode(buffer, offset);
//     return data.chars.toString('utf8');
//   };

//   rsl.encode = (str, buffer, offset) => {
//     const data = {
//       chars: Buffer.from(str, 'utf8'),
//     };
//     return _encode(data, buffer, offset);
//   };

//   return rsl;
// };

function u64LEBuffer(n: bigint): Buffer {
  const buf = Buffer.allocUnsafe(8)
  buf.writeBigUInt64LE(n)
  return buf
}

interface MintInfo {
  /**
   * Optional authority used to mint new tokens. The mint authority may only be provided during
   * mint creation. If no mint authority is present then the mint has a fixed supply and no
   * further tokens may be minted.
   */
  mintAuthority: null | PublicKey,

  /**
   * Total supply of tokens
   */
  supply: BigInt,

  /**
   * Number of base 10 digits to the right of the decimal place
   */
  decimals: number,

  /**
   * Is this mint initialized
   */
  isInitialized: boolean,

  /**
   * Optional authority to freeze token accounts
   */
  freezeAuthority: null | PublicKey,
}