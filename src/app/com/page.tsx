"use client"
import { useEffect, useMemo, useState, useRef } from "react"
import "react-json-pretty/themes/monikai.css"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Coins, Pickaxe, Key, PlusCircle, Users, Database, Clock, Trash2 } from "lucide-react"
import { sendData } from "@/lib/communication"
import { type SignedTransactionData, Transaction, transactionsFromTransactionsData } from "@/lib/transactions"
import { useBlockChainContext } from "@/context/blockchain"
import { useConnectionContext } from "@/context/connectionContext"
import { useOpenPGPContext } from "@/context/openpgp"
import { MinedBlock, type MinedBlockData, PendingBlock } from "@/lib/blocks"
import type { Payload } from "@/lib/requester"
import type { RequestOtherPublicKey } from "@/lib/messages"
import TransactionCard from "./TransactionCard"
import BlockCard from "./BlockCard"
import ConnCard from "@/components/specific/main/connCard"

export type Data = object

export interface Message extends Data {
  message: string
}

export interface Packet {
  sender: string
  receivers: string[]
  type: string
  data: Data
}

export interface PublicKeyShare {
  publicKey: string
}

export interface BroadcastOtherPublicKeys {
  otherPublicKeys: Map<string, string>
}

export default function Page() {
  // return (
  //   <div></div>
  // )
  const [unverifiedPackages, setUnverifiedPackages] = useState<Packet[]>([])

  const { clearBlocks, pendingTransactions, minedBlocks, addPendingTransaction, addBlock, mineBlockFromTransactions, getBlockByHash, calculateBalance, sendCurrencyToEveryone, mineLatestTransaction, broadcastBlock } = useBlockChainContext()
  const pgp = useOpenPGPContext()

  const { peer, peerName, connectedCons, addDataHandler, requesters, addRRHandler } = useConnectionContext()
  const areDataHandlersSet = useRef(false)


  useEffect(() => {
    if (areDataHandlersSet.current) {
      return
    }
    areDataHandlersSet.current = true

    console.log("Adding data handler 1")

    addDataHandler((packet: Packet) => {
      if (packet.type == "transaction") {
        console.log("Received transaction packet:", packet);
        const data = packet.data as SignedTransactionData
        if (Number.isNaN(data.transactionId)) {
          console.warn("Received transaction without transactionId, ignoring", data);
          return
        }
        const transaction = new Transaction(data.transactionId, data.amount, data.sender, data.receiver, data.signMessage)
        console.log("Created transaction object:", transaction);
        addPendingTransaction(transaction)
        console.log("Added transaction to pending transactions");
      }

      if (packet.type == "block") {
        console.log("Received block packet:", packet);
        const blockData = packet.data as MinedBlockData

        const transactions = transactionsFromTransactionsData(blockData.transactions)
        console.log("Created transactions from block data:", transactions);

        const previousBlock = getBlockByHash(blockData.previousHash)

        console.log("searching for previous block with hash:", blockData.previousHash)

        if (blockData.previousHash && !previousBlock) {
          console.error("Could not find previous block:", blockData.previousHash)
          return
        }

        const block = new MinedBlock(previousBlock, blockData.previousHash, blockData.proofOfWork, transactions)
        console.log("created block object:", block);
        addBlock(block, true)
        console.log("Added block to blockchain");
      }
    })
  }, [
    addDataHandler,
    addRRHandler,
    addBlock,
    addPendingTransaction,
    getBlockByHash,
    pgp.publicKeys,
    pgp.publicKeys.get,
    minedBlocks,
  ])


  async function requestPublicKeys() {
    console.log("requesting public keys")
    await Promise.all(
      connectedCons.map(async (conn) => {
        const requester = requesters.get(conn.peer)
        if (requester) {
          const publicKey = await requester.request<Payload<RequestOtherPublicKey>, Payload>({
            type: "requestOtherPublicKey",
            payload: {
              peer: peerName,
            },
          })
          console.log("received public key:", publicKey.payload)
        }
      }),
    )
  }

  useEffect(() => {
    console.log("setPendingTransactions received", pendingTransactions.length, pendingTransactions)
  }, [pendingTransactions])

  const [balance, setBalance] = useState(0)

  const ownBalance = useMemo(() => {
    if (!peer) { return }
    
    const balancePromise = calculateBalance(pgp.publicKeys, peer.id)
    
    balancePromise
      .then(balance => setBalance(balance))
      .catch(error => console.error("Error calculating balance:", error))
    
    return null
  }, [calculateBalance, pgp.publicKeys, peer, minedBlocks])

  function addFakeButCoherentBlockToOwnChain() {
    if (!peer) { return }
    const pendingBlock = new PendingBlock([])
    const lastBlock = minedBlocks[minedBlocks.length - 1]
    const minedBlock = pendingBlock.mine(lastBlock, lastBlock.getHash())
    addBlock(minedBlock, true)

    // broadcastBlock(minedBlock)
  }

  function clearOwnChain() {
    clearBlocks()
  }

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <Card className="shadow-md">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Peer ID:</span>
              <span className="font-mono bg-muted px-2 py-1 rounded text-sm break-all">{peer?.id}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Public Keys:</span>
              <span className="font-mono bg-muted px-2 py-1 rounded text-sm">{pgp.publicKeys.size}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Balance:</span>
              <span className="font-mono bg-primary/10 text-primary px-2 py-1 rounded text-sm font-semibold">
                {balance}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="shadow-md border-muted lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold">Actions</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 p-4">
            <div className="space-y-3">
              <h3 className="text-md font-semibold text-muted-foreground">Normal Actions</h3>
              <div className="grid gap-2">
                <Button onClick={() => sendCurrencyToEveryone(pgp.privateKey)} className="w-full justify-start" variant="outline">
                  <Coins className="mr-2 h-4 w-4" />
                  Send Currency To Everyone
                </Button>

                <Button onClick={mineLatestTransaction} className="w-full justify-start" variant="outline">
                  <Pickaxe className="mr-2 h-4 w-4" />
                  Mine Latest Transaction
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-md font-semibold text-muted-foreground">Attack Actions</h3>
              <div className="grid gap-2">
                <Button onClick={requestPublicKeys} className="w-full justify-start" variant="outline">
                  <Key className="mr-2 h-4 w-4" />
                  Request Public Keys
                </Button>

                <Button onClick={addFakeButCoherentBlockToOwnChain} className="w-full justify-start" variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Fake But Coherent Block
                </Button>

                <Button onClick={clearOwnChain} className="w-full justify-start" variant="outline">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Own Chain
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Active Connections ({connectedCons.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 h-[300px] overflow-y-auto p-4">
              {connectedCons.length > 0 ? (
                connectedCons.map((conn, index) => (
                  <ConnCard conn={conn} key={index} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">No active connections</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Pending Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 h-[300px] overflow-y-auto p-4">
              {pendingTransactions.length > 0 ? (
                pendingTransactions
                  .slice(-5)
                  .map((transaction, index) => (
                    <TransactionCard transaction={transaction} key={index} publicKeys={pgp.publicKeys} />
                  ))
              ) : (
                <div className="text-center text-muted-foreground py-4">No pending transactions</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md col-span-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Mined Blocks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 h-[400px] overflow-y-auto p-4">
              {minedBlocks.length > 0 ? (
                minedBlocks.slice(-5).map((block, index) => <BlockCard key={index} block={block} />)
              ) : (
                <div className="text-center text-muted-foreground py-4">No blocks mined yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

