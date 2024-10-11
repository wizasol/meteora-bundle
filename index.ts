import {
  ConstantProductSwap,
  derivePoolAddress,
} from '@mercurial-finance/dynamic-amm-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import {
  CONSTANT_PRODUCT_DEFAULT_TRADE_FEE_BPS,
  FEE_OWNER,
  METAPLEX_PROGRAM,
  SEEDS
} from '@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/constants';
import { jitoWithAxios } from './jitoWithAxios';
import {
  createProgram,
  deriveMintMetadata,
  generateCurveType,
  wrapSOLInstruction
} from '@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils';
import VaultImpl,
{ getVaultPdas } from '@mercurial-finance/vault-sdk';
import {
  getAssociatedTokenAccount,
  getOrCreateATAInstruction,
  unwrapSOLInstruction
} from '@mercurial-finance/vault-sdk/dist/cjs/src/vault/utils';
import {
  Account,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAccount,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';

const RPC = "https://"
// const RPC = "https://"
const KEY_FOR_CREATE_POOL = "";
const KEY_FOR_BUY = "";

const tokenInfoA: any = { address: "So11111111111111111111111111111111111111112" };
const tokenInfoB: any = { address: "ErLWbcwqwaMWeMbzXQ9AoPMisTX44J7PfAsLsfdN24ij" };

const inTokenMint: any = { address: "So11111111111111111111111111111111111111112", };

//  Deposit Amount
const tokenADepositAmount = new BN(100);
const tokenBDepositAmount = new BN(100);

//  First Buy Amount
const inAmountLamport = new BN(20);

async function createATAPreInstructions(owner: PublicKey, mintList: Array<PublicKey>) {
  console.log("=========================> ");
  return Promise.all(
    mintList.map((mint) => {
      return getOrCreateATAInstruction(mint, owner, connection);
    }),
  );
}

async function wrapSol(connection: Connection, wallet: Keypair, amount: number): Promise<PublicKey> {
  const associatedTokenAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );
    // **
    // *
    // *  Contact to developer
    // *
    // **
}

const payer0 = Keypair.fromSecretKey(bs58.decode(KEY_FOR_CREATE_POOL))
const payer = Keypair.fromSecretKey(bs58.decode(KEY_FOR_BUY))

export const connection = new Connection(RPC, { commitment: "finalized" });
const tradeFeeBps = new BN(CONSTANT_PRODUCT_DEFAULT_TRADE_FEE_BPS);

(async () => {

  console.log(payer0.publicKey.toBase58());
  console.log(payer.publicKey.toBase58());

  // ================================ Convert Sol to Wrapped Sol ================================
    // **
    // *
    // *  Wrap Sol part
    // *
    // **

  let versionedTxs: VersionedTransaction[] = []
  const isStable = false;

  // ================================ Calculate Pool Key ================================

  const poolPubkey = derivePoolAddress(connection, tokenInfoA, tokenInfoB, false, tradeFeeBps);

  console.log("poolPubkey : ", poolPubkey.toBase58());
  console.log("balance : ", await connection.getBalance(payer0.publicKey));

  const { vaultProgram, ammProgram } = createProgram(connection);
  const curveType = generateCurveType(tokenInfoA, tokenInfoB, isStable);

  const tokenAMint = new PublicKey(tokenInfoA.address);
  const tokenBMint = new PublicKey(tokenInfoB.address);

  const [
    { vaultPda: aVault, tokenVaultPda: aTokenVault, lpMintPda: aLpMintPda },
    { vaultPda: bVault, tokenVaultPda: bTokenVault, lpMintPda: bLpMintPda },
  ] = [getVaultPdas(tokenAMint, vaultProgram.programId), getVaultPdas(tokenBMint, vaultProgram.programId)];

  console.log("aVault : ", aVault);
  console.log("bVault : ", bVault);

  const [aVaultAccount, bVaultAccount] = await Promise.all([
    vaultProgram.account.vault.fetchNullable(aVault),
    vaultProgram.account.vault.fetchNullable(bVault),
  ]);

  let aVaultLpMint = aLpMintPda;
  let bVaultLpMint = bLpMintPda;
  let create_pool_preInstructions: Array<TransactionInstruction> = [];
  const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 600_000,
  });
  create_pool_preInstructions.push(setComputeUnitLimitIx);

  if (!aVaultAccount) {
    const createVaultAIx = await VaultImpl.createPermissionlessVaultInstruction(
      connection,
      payer0.publicKey,
      new PublicKey(tokenInfoA.address),
    );
    // createVaultAIx && create_pool_preInstructions.push(createVaultAIx);

    const tx = new Transaction().add(createVaultAIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [payer0])
    console.log("Vault Account created");
    console.log(sig);
  } else {
    aVaultLpMint = aVaultAccount.lpMint; // Old vault doesn't have lp mint pda
  }

  if (!bVaultAccount) {
    const createVaultBIx = await VaultImpl.createPermissionlessVaultInstruction(
      connection,
      payer0.publicKey,
      new PublicKey(tokenInfoB.address),
    );
    console.log("thisB");
    // createVaultBIx && create_pool_preInstructions.push(createVaultBIx);

    const tx = new Transaction().add(createVaultBIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [payer0])

    console.log("Vault Account created");
    console.log(sig);
  } else {
    bVaultLpMint = bVaultAccount.lpMint; // Old vault doesn't have lp mint pda
  }

  const [[aVaultLp], [bVaultLp]] = [
    PublicKey.findProgramAddressSync([aVault.toBuffer(), poolPubkey.toBuffer()], ammProgram.programId),
    PublicKey.findProgramAddressSync([bVault.toBuffer(), poolPubkey.toBuffer()], ammProgram.programId),
  ];

  const [[payerTokenA, createPayerTokenAIx], [payerTokenB, createPayerTokenBIx]] = await Promise.all([
    getOrCreateATAInstruction(tokenAMint, payer0.publicKey, connection),
    getOrCreateATAInstruction(tokenBMint, payer0.publicKey, connection),
  ]);


  if (tokenAMint.equals(NATIVE_MINT)) {
    console.log("tokenAMint is Native token");

    // create_pool_preInstructions.push(...wrapSOLInstruction(payer.publicKey, payerTokenA, BigInt(tokenADepositAmount.toString())))
    create_pool_preInstructions = create_pool_preInstructions.concat(wrapSOLInstruction(payer0.publicKey, payerTokenA, BigInt(tokenADepositAmount.toString())));
  }

  if (tokenBMint.equals(NATIVE_MINT)) {
    console.log("tokenBMint is Native token");
    // create_pool_preInstructions.push(...wrapSOLInstruction(payer.publicKey, payerTokenB, BigInt(tokenBDepositAmount.toString())))
    create_pool_preInstructions = create_pool_preInstructions.concat(wrapSOLInstruction(payer0.publicKey, payerTokenB, BigInt(tokenBDepositAmount.toString())));
  }

  createPayerTokenAIx && create_pool_preInstructions.push(createPayerTokenAIx);
  createPayerTokenBIx && create_pool_preInstructions.push(createPayerTokenBIx);

  const [[protocolTokenAFee], [protocolTokenBFee]] = [
    PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.FEE), tokenAMint.toBuffer(), poolPubkey.toBuffer()],
      ammProgram.programId,
    ),
    PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.FEE), tokenBMint.toBuffer(), poolPubkey.toBuffer()],
      ammProgram.programId,
    ),
  ];

  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.LP_MINT), poolPubkey.toBuffer()],
    ammProgram.programId,
  );

  const payerPoolLp = await getAssociatedTokenAccount(lpMint, payer0.publicKey);


  const [mintMetadata, _mintMetadataBump] = deriveMintMetadata(lpMint);

  const tempCreatePermissionlessPoolIx = await ammProgram.methods
    // **
    // *
    // *  Contact to developer
    // *
    // **
    .instruction();

  const blockhash = (await connection.getLatestBlockhash()).blockhash
  const tempCreatePermissionlessPoolMessage = new TransactionMessage({
    payerKey: payer0.publicKey,
    recentBlockhash: blockhash,
    instructions: [tempCreatePermissionlessPoolIx, ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })]
  }).compileToV0Message();

  const versionedCreatePermissionlessPool = new VersionedTransaction(tempCreatePermissionlessPoolMessage)

  console.log((await connection.simulateTransaction(versionedCreatePermissionlessPool)).value.logs)

  versionedCreatePermissionlessPool.sign([payer0])

  versionedTxs.push(versionedCreatePermissionlessPool)



  // ===================================== create reciever ata

  // Get the receiver's associated token account address
  const receiverTokenAccountAddress = await getAssociatedTokenAddress(
    new PublicKey(tokenInfoB.address),
    payer.publicKey
  )

  // Create a new transaction
  const transaction = new Transaction()

  // Create an instruction to create the receiver's token account if it does not exist
  const createAccountInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    receiverTokenAccountAddress,
    payer.publicKey,
    new PublicKey(tokenInfoB.address),
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  // Check if the receiver's token account exists
  let receiverTokenAccount: Account;
  try {
    receiverTokenAccount = await getAccount(
      connection,
      receiverTokenAccountAddress,
      "confirmed",
      TOKEN_PROGRAM_ID
    )
  } catch (e) {
    // If the account does not exist, add the create account instruction to the transaction
    transaction.add(createAccountInstruction)

    const sig = await sendAndConfirmTransaction(connection, transaction, [payer])

    console.log(sig);

  }

  // ===================================== end create reciever ata

  const [sourceToken, destinationToken] = (tokenInfoA.address == inTokenMint.address)
    ? [tokenInfoA, tokenInfoB]
    : [tokenInfoB, tokenInfoA];

  const protocolTokenFee = (tokenInfoA.address == inTokenMint.address)
    ? protocolTokenAFee
    : protocolTokenBFee;

  let swap_preInstructions: Array<TransactionInstruction> = [];

  const [[userSourceToken, createUserSourceIx], [userDestinationToken, createUserDestinationIx]] =
    await createATAPreInstructions(payer.publicKey, [new PublicKey(sourceToken.address), new PublicKey(destinationToken.address)]);

  createUserSourceIx && swap_preInstructions.push(createUserSourceIx);
  createUserDestinationIx && swap_preInstructions.push(createUserDestinationIx);

  if (sourceToken.address == NATIVE_MINT.toBase58()) {
    swap_preInstructions = swap_preInstructions.concat(
      wrapSOLInstruction(payer.publicKey, userSourceToken, BigInt(inAmountLamport.toString())),
    );
  }

  const postInstructions: Array<TransactionInstruction> = [];
  if (destinationToken.address == NATIVE_MINT.toBase58()) {
    const unwrapSOLIx = await unwrapSOLInstruction(payer.publicKey);
    unwrapSOLIx && postInstructions.push(unwrapSOLIx);
  }

  const swapCurve = new ConstantProductSwap();
  const remainingAccounts = swapCurve.getRemainingAccounts();

  const tempSwapTx = await ammProgram.methods
    // **
    // *
    // *  Contact to developer
    // *
    // **
    .instruction();
  const blockhash2 = (await connection.getLatestBlockhash()).blockhash
  const swapMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash2,
    instructions: [tempSwapTx]
  }).compileToV0Message();

  const versionedSwapMessage = new VersionedTransaction(swapMessage)

  console.log((await connection.simulateTransaction(versionedSwapMessage)).value.logs)


  versionedSwapMessage.sign([payer])

  versionedTxs.push(versionedSwapMessage)
  // const sig2 = await sendAndConfirmTransaction(connection, versionedSwapMessage, [payer])


  console.log("------------- Bundle & Send ---------")
  console.log("Please wait for 30 seconds for bundle to be completely executed by all nearests available leaders!");
  let result;
  while (1) {
    result = await jitoWithAxios(versionedTxs, payer)
    if (result.confirmed) {
      console.log("Success ==================> ", result.sig);
      break;
    };
  }
})()
