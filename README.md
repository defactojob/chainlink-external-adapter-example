
See list of external-adapters:

https://github.com/smartcontractkit/external-adapters-js

https://docs.chain.link/docs/running-a-chainlink-node

ETH_URL=wss://rinkeby.infura.io/ws/v3/0834aab6765f4fcfbb7254e18e1cc212


# create chainlink database

```
dc exec postgres psql -U postgres
```

```
create database chainlink
```

# authorization & keystore

follow: https://docs.chain.link/docs/miscellaneous#config

need to configure node to be able to access ethereum

1. generate a geth wallet
2. make the geth wallet keystore file accessible within docker as keystore.json

geth wallet password: dockVsADx8yiV6Y6EsHiPE6fNVV8edVv

```
geth new account

0xca35A712d957D55BdB22B41272D268d711a117ee
```

* cp the generated wallet keystore file to `var/data/chainlink/keystore.json`
* import it into the node:

```
dc run chainlink local import \
  /chainlink/keystore.json
```

* request some fund from rinkeby faucet

some more config:

* chainlink login / password in: `var/data/chainlink/.api`
* geth wallet password in: `var/data/chainlink/.password`

# admin interface

* accessible via port 6688

# job

* create a job:
  * http://104.237.155.93:6688/jobs/new

```
{
  "initiators": [
    {
      "type": "web"
    }
  ],
  "tasks": [
    {
      "type": "HTTPGet",
      "confirmations": 0,
      "params": { "get": "https://bitstamp.net/api/ticker/" }
    },
    {
      "type": "JSONParse",
      "params": { "path": [ "last" ] }
    },
    {
      "type": "Multiply",
      "params": { "times": 100 }
    },
    {
      "type": "NoOp"
    }
  ],
  "startAt": null,
  "endAt": null,
  "minPayment": "1000000000000000000"
}
```

* startAt requires the task to be run after that time
* payment: 1 link
  * can just trigger from the job page, without paying anything

* different ways to trigger a job:
  * https://github.com/smartcontractkit/chainlink/blob/a7e39b428731edc278b455b47276e4f3b2eb6151/core/store/models/job_spec.go#L172-L194

# add a bridge / external adapter

http://104.237.155.93:6688/bridges/new

https://docs.chain.link/docs/developers

* example adapter

https://github.com/smartcontractkit/external-adapters-js/blob/master/bravenewcoin/adapter.js

* helpers for validating input and returning output (kinda pointless)

https://www.npmjs.com/package/@chainlink/external-adapter

> If the node has a value defined for the Bridge Response URL, the payload will include a "responseURL" field that can be used to update responses via PATCH requests:

* how do you define a bridge response URL?

* is there someway for the node to authenticate with the external adapter?
  * ya. looks like there is no way to configure that

```
{
  "initiators": [
    {
      "type": "web"
    }
  ],
  "tasks": [
    {
      "type": "now",
      "confirmations": 0
    },
    {
      "type": "NoOp"
    }
  ],
  "startAt": null,
  "endAt": null,
  "minPayment": "1000000000000000000"
}
```

```
curl -X POST -H "content-type: application/json" localhost:9779/chainlink/now -d '
{
  "id": "12341234",
  "data": null
}
'
```

# binance websocket

```
go get -u github.com/hashrocket/ws
```

* 1m candle

```
ws wss://stream.binance.com:9443/ws/btcusdt@kline_1m
```

* book

```
ws wss://stream.binance.com:9443/ws/btcusdt@bookTicker
```

* autg?

# questions

* what are confirmations for? different contexts:
  * bridge confirmation
  * incoming/outgoing confirmation
  * job confirmation
* the initiators are kinda limited... not sure if the request/response cycles of chainlink oracles fit the idea of "pumping price feed onto solana".
  * i think for solana what's interesting is really just streaming data onto it.
  * what's the latency of a job creation/completion cycle?
  * the price feed depends on fluxmonitor
    * how does the node monitor the price change? poll?
* i think i probably need to look into the idea of round/flux/incentive to better understand how it would make sense (and if it makes sense) to for chainlink oracles to pump price feed onto solana.
  * and how would you aggregate?
  * probably create a "events" external initiator or something
    * websocket listening to event from an external service that pumps triggering events into it.
      * super violent lol.