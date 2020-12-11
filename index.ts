import fastify from "fastify"
import { FastifyRequest } from "fastify"
import { PublicKey, Connection, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js"

import { connection, payer } from "./utils"


// program account:
// abe6eae8dd8c8049df28efdeb6dd456c469450f090313190379376de066e78dcb1106d4c29063f991c8580df8a56bb467f6fcc7678a5a3f1e82c0e3e4c36348a

import WebSocket from "ws"

async function updateSolanaBTCUSDT(tick: BookTick): Promise<string> {
  const mid = Math.floor((tick.bid + tick.ask) / 2 / 1e8)

  const programId = new PublicKey("FpWDVR4Df1o7NK7i3Vc7UutaTtxanJpRNgiaesVwDM5L")
  const programAccountPubKey = new PublicKey("CvBh46cSS4odS7cfyphfZrzBzwB5aMQYhdLbogMfbMyT")

  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(mid)

  const instruction = new TransactionInstruction({
    keys: [{pubkey: programAccountPubKey, isSigner: false, isWritable: true}],
    programId,
    data: buf,
  })

  const tx = new Transaction()
  tx.add(instruction)

  const txid = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'singleGossip',
    preflightCommitment: 'singleGossip',
  })

  return txid
}

// https://github.com/binance-exchange/binance-official-api-docs/blob/master/web-socket-streams.md
const btcusdtWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@bookTicker")

// btcusdtWS.on("close") // closed very 24h per binance spec
btcusdtWS.on("open", () => {
  console.log("btcusdt price feed connected")
})

interface BookTick {
  symbol: string // symbol
  bid: number
  bidQty: number
  ask: number
  askQty: number

  decimals: number

  // decimals 8
}

let curBTC_USDT: BookTick

btcusdtWS.on("message", (data) => {
  const tick = JSON.parse(data as string)

  // console.log(typeof data, data)
  // TODO: hrm. how better to convert from float to int?

  const decimals = 1e8

  const bid = Math.floor(parseFloat(tick.b) * decimals)
  const bidQty = Math.floor(parseFloat(tick.B) * decimals)

  const ask = Math.floor(parseFloat(tick.a) * decimals)
  const askQty = Math.floor(parseFloat(tick.A) * decimals)

  const symbol = tick.s

  curBTC_USDT = {
    symbol,
    bid,
    bidQty,
    ask,
    askQty,
    decimals: 8
  }
})


const app = fastify({ logger: true })

app.get("/btc_usdt", async (req, res) => {
  return curBTC_USDT
})

app.get("/now", async (req, res) => {
  const now = new Date()
  return { string: now.toISOString(), number: now.getTime() }
})

type UpdateBTCUSDTRequest = FastifyRequest<{
  Body: {
    id: string,
    data: any,
  }
}>

interface UpdateBTCUSDTReply {
  jobRunID: string
  data: {
    txid: string,
    // "result" seems like a speciel field that gets displayed by the UI
    result: BookTick
  }
}

app.post("/chainlink/update_btc_usdt", async (req: UpdateBTCUSDTRequest, res): Promise<UpdateBTCUSDTReply> => {
  const { id } = req.body

  if (!curBTC_USDT) {
    throw new Error("Waiting for btc usdt price to update")
  }

  const txid = await updateSolanaBTCUSDT(curBTC_USDT)

  return {
    jobRunID: id,
    data: {
      txid,
      result: curBTC_USDT
    }
  }
})

type NowRequest = FastifyRequest<{
  Body: {
    id: string,
    data: any,
  }
}>

interface NowReply {
  jobRunID: string
  data: {
    string: string
    number: number

    // "result" seems like a special field that gets displayed by the UI
    result: any
  }
}

app.post("/chainlink/now", async (req: NowRequest, res): Promise<NowReply> => {
  const now = new Date()

  console.log(req.method, req.routerPath, req.body)

  const { id, data } = req.body

  return {
    jobRunID: id,
    data: {
      string: now.toISOString(),
      number: now.getTime(),
      result: "<b>yoyo</b>",
    },
  }
})

// job
// https://docs.chain.link/docs/developers

// hmm. how to create a transactor?

const port = process.env.PORT || 9779
const host = process.env.HOST || "127.0.0.1"

// container can access host port at 172.17.0.1:9779
console.log(`listening: ${host}/${port}`)
app.listen(port, host)