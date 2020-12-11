
* one trick is to use Account/Pubkey to distinguish between signer or not.
  * as for readonly...

newInstruction(
  programID,
  data,
  [account, pubkey, pubkey, account, {write: account}]
)

this.buildInstruction({
  data,
  layout
}, [account, pubkey, pubkey, account, {write: account}])

hmm... how to support multisig?

* todo: improve serialization...

lol... i can't come up with a name.

solano
soldo
solmake
solny
solnu
solanaweb
solana-make
solanatake

solke
soldo
solrun

