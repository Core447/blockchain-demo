"use client"
import { useEffect, useMemo, useState, useRef } from "react"
import "react-json-pretty/themes/monikai.css"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Coins, Pickaxe, Key, PlusCircle, Users, Database, Clock, Trash2, ChevronUp, ChevronDown, Award } from "lucide-react"
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
import { LoadingOverlay } from "@/components/ui/loading-overlay"
import { InfoButton } from "@/components/specific/InfoButton"
import { CardInfoButton } from "@/components/specific/CardInfoButton"
import { HelpGuide } from "@/components/specific/HelpGuide"

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

  const { clearBlocks, pendingTransactions, minedBlocks, isMining, addPendingTransaction, addBlock, mineBlockFromTransactions, getBlockByHash, calculateBalance, sendCurrencyToEveryone, mineLatestTransaction, broadcastBlock } = useBlockChainContext()
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
  const [blockRewardsToClaim, setBlockRewardsToClaim] = useState(1)

  useEffect(() => {
    if (!peer) { return }
    const balancePromise = calculateBalance(pgp.publicKeys, peer.id)
    balancePromise
      .then(balance => setBalance(balance))
      .catch(error => console.error("Error calculating balance:", error))
  }, [calculateBalance, pgp.publicKeys, peer, minedBlocks])

  function addCoherentBlockToLocalChain() {
    if (!peer) { return }
    const pendingBlock = new PendingBlock([])
    const lastBlock = minedBlocks[minedBlocks.length - 1]
    const minedBlock = pendingBlock.mine(lastBlock, lastBlock ? lastBlock.getHash() : null, peer.id, blockRewardsToClaim)
    addBlock(minedBlock, true)

    // broadcastBlock(minedBlock)
  }

  function clearLocalChain() {
    clearBlocks()
  }

  function incrementBlockRewards() {
    setBlockRewardsToClaim(prev => Math.min(prev + 1, 5))
  }

  function decrementBlockRewards() {
    setBlockRewardsToClaim(prev => Math.max(prev - 1, 0))
  }

  function handleBlockRewardsInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 0 && value <= 5) {
      setBlockRewardsToClaim(value)
    }
  }

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <>
      <LoadingOverlay isVisible={isMining} message="Mining..." />
      <HelpGuide />
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
                <div className="flex items-center">
                  <Button onClick={() => sendCurrencyToEveryone(pgp.privateKey)} className="flex-1 justify-start" variant="outline">
                    <Coins className="mr-2 h-4 w-4" />
                    Send Currency To Everyone
                  </Button>
                  <InfoButton
                    title="Send Currency To Everyone"
                    description={
                      <div className="space-y-2">
                        <p>Creates and broadcasts a transaction sending a random number of currency units (between 0 and 1000) to each peer currently online.</p>
                        <p className="font-semibold">How it works:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>For each active connection, a signed transaction is created</li>
                          <li>All created transactions are broadcast to all connected peers</li>
                          <li>These transactions must be mined before they take effect</li>
                        </ul>
                        <p className="text-sm text-muted-foreground">💡 This is a quick way to generate network activity and test the blockchain.</p>
                      </div>
                    }
                  />
                </div>

                <div className="flex items-center">
                  <Button 
                    onClick={() => mineLatestTransaction(blockRewardsToClaim)} 
                    className="flex-1 justify-start" 
                    variant="outline"
                    disabled={isMining}
                  >
                    <Pickaxe className="mr-2 h-4 w-4" />
                    {isMining ? "Mining..." : "Mine Latest Transaction"}
                  </Button>
                  <InfoButton
                    title="Mine Latest Transaction"
                    description={
                      <div className="space-y-2">
                        <p>Processes pending transactions by mining and creating a new block.</p>
                        <p className="font-semibold">Mining process:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Takes the oldest pending transaction from the pool</li>
                          <li>Adds a miner/block reward transaction to yourself</li>
                          <li>Creates a new block containing the transaction and the miner reward</li>
                          <li>Searches for a valid proof of work</li>
                          <li>Broadcasts the new block to all connected peers</li>
                        </ul>
                        <p className="text-sm text-muted-foreground">⛏️ Mining can take several seconds depending on your computer&apos;s speed.</p>
                        <p className="text-sm text-muted-foreground">💰 You earn block rewards for successfully mining!</p>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-md font-semibold text-muted-foreground">Attack Actions</h3>
              <div className="grid gap-2">
                {/* <div className="flex items-center">
                  <Button onClick={requestPublicKeys} className="flex-1 justify-start" variant="outline">
                    <Key className="mr-2 h-4 w-4" />
                    Request Public Keys
                  </Button>
                  <InfoButton
                    title="Request Public Keys"
                    description={
                      <div className="space-y-2">
                        <p>Requests the public encryption keys from all connected peers in the network.</p>
                        <p className="font-semibold">Why this is important:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Public keys are needed to verify transaction signatures</li>
                          <li>Without public keys, you can&apos;t validate if transactions are authentic</li>
                          <li>This is essential for blockchain security</li>
                          <li>Each peer stores a map of peer IDs to their public keys</li>
                        </ul>
                        <p className="text-sm text-muted-foreground">🔑 Always request public keys when joining the network!</p>
                      </div>
                    }
                  />
                </div> */}

                <div className="flex items-center">
                  <Button onClick={addCoherentBlockToLocalChain} className="flex-1 justify-start" variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Coherent Block To Local Chain
                  </Button>
                  <InfoButton
                    title="Add Coherent Block To Local Chain"
                    description={
                      <div className="space-y-2">
                        <p>Creates a valid block in your local blockchain.</p>
                        <p className="font-semibold">How it works:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Creates a new block with the last block as the previous block</li>
                          <li>Adds a miner/block reward transaction to yourself</li>
                          <li>Mines the block</li>
                          <li><strong>Doesn&apos;t</strong> broadcast the block to the network</li>
                        </ul>
                        <p>Can be used to test how the network resolves conflicting chains.</p>
                      </div>
                    }
                  />
                </div>

                <div className="flex items-center">
                  <Button onClick={clearLocalChain} className="flex-1 justify-start" variant="outline">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Local Chain
                  </Button>
                  <InfoButton
                    title="Clear Local Chain"
                    description={
                      <div className="space-y-2">
                        <p>Deletes your entire local blockchain, resetting it to an empty state.</p>
                        <p className="font-semibold">Use cases:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Start fresh with a clean blockchain</li>
                          <li>Test how new nodes react when it receives an empty blockchain from another node</li>
                        </ul>
                        <p className="text-sm text-muted-foreground">🔄 After clearing,the only way to restore the blocks is to reload the page</p>
                      </div>
                    }
                  />
                </div>

                <div className="flex items-center">
                  <div className="border rounded-md p-3 space-y-2 flex-1">
                    <Label className="text-sm font-medium flex items-center">
                      <Award className="mr-2 h-4 w-4" />
                      Number of block rewards to claim
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={blockRewardsToClaim}
                        onChange={handleBlockRewardsInputChange}
                        min={0}
                        max={5}
                        className="h-8 w-16 text-center"
                      />
                    </div>
                  </div>
                  <InfoButton
                    title="Block Rewards"
                    description={
                      <div className="space-y-2">
                        <p>Adjust how many block rewards you claim when mining a block.</p>
                        <p className="font-semibold">How it works:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Standard reward is 1 block reward per mined block</li>
                          <li>You can set it between 0 and 5</li>
                          <li>Higher rewards give you more currency when you mine</li>
                        </ul>
                      <p className="text-sm bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                        ⚠️ Allows you to test what happens when a user claims more coins as a block reward than the network allows
                      </p>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Active Connections ({connectedCons.length})
                </div>
                <CardInfoButton
                  title="Active Connections"
                  description={
                    <div className="space-y-2">
                      <p>This section shows all peers currently in the peer-to-peer network.</p>
                      <p className="font-semibold">What you can see:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Peer ID:</strong> The unique identifier of each connected peer</li>
                        <li><strong>Balance:</strong> How much currency each peer currently has</li>
                      </ul>
                      <p className="font-semibold">You can click on a peer to:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Send Currency:</strong> Send them specific amount of currency</li>
                        <li><strong>Steal Currency:</strong> Add a transaction from this peer to your own balance</li>
                      </ul>
                      <p className="text-sm text-muted-foreground">💡 More connections mean a more secure and decentralized network!</p>
                    </div>
                  }
                />
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
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Pending Transactions
                </div>
                <CardInfoButton
                  title="Pending Transactions"
                  description={
                    <div className="space-y-2">
                      <p>This section displays transactions that have been created but not yet mined into a block.</p>
                      <p className="font-semibold">Transaction lifecycle:</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>Someone creates and signs a transaction</li>
                        <li>The transaction is broadcast to all connected peers</li>
                        <li>All peers add it to their pending transaction pool</li>
                        <li>The transaction waits here until someone mines it</li>
                        <li>Once mined into a block, it moves to the blockchain</li>
                      </ol>
                      <p className="font-semibold">Understanding transaction details:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Transaction ID:</strong> Unique identifier for this transaction</li>
                        <li><strong>Sender → Receiver:</strong> Who is sending to whom</li>
                        <li><strong>Amount:</strong> How much currency is being transferred</li>
                        <li><strong>Valid/Invalid Badge:</strong> Whether the signature is valid</li>
                      </ul>
                      <p className="text-sm text-muted-foreground">⏳ Transactions stay pending until mined. You can mine them by clicking &quot;Mine Latest Transaction&quot;.</p>
                    </div>
                  }
                />
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
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  Mined Blocks
                </div>
                <CardInfoButton
                  title="Mined Blocks"
                  description={
                    <div className="space-y-2">
                      <p>This is the blockchain, the ordered record of all mined blocks.</p>
                      <p className="font-semibold">What is a block?</p>
                      <p>A block is a container that includes:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Block Hash:</strong> Unique identifier (first 5 characters shown)</li>
                        <li><strong>Previous Hash:</strong> Reference to the parent block, creating the &quot;chain&quot;</li>
                        <li><strong>Proof of Work:</strong> The computational solution that validates this block</li>
                        <li><strong>Transactions:</strong> A list of transactions included in this block</li>
                      </ul>
                      <p className="font-semibold">Block validation:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>✓ <span className="text-green-600 dark:text-green-400">Green Badge</span> = Valid block with correct hash and signatures</li>
                        <li>✗ <span className="text-red-600 dark:text-red-400">Red Badge</span> = Invalid block (wrong hash or invalid transactions)</li>
                      </ul>
                      <p className="text-sm text-muted-foreground">🔗 Click on a block to expand and see all its details including transactions.</p>
                      <p className="text-sm text-muted-foreground">📊 The most recent blocks are shown at the bottom.</p>
                    </div>
                  }
                />
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
    </>
  )
}

