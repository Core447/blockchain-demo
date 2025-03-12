"use client"

import type { BlockChainContextType } from "@/context/blockchain"
import type { OpenPGPContextType } from "@/context/openpgp"
import type { DataConnection } from "peerjs"
import { useEffect, useState } from "react"
import { ChevronRight, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Transaction } from "@/lib/transactions"
import { sendData } from "@/lib/communication"
import { useConnectionContext } from "@/context/connectionContext"

interface ConnCardProps {
  conn: DataConnection
  blockchain: BlockChainContextType
  pgp: OpenPGPContextType
}

export default function ConnCard({ conn, blockchain, pgp }: ConnCardProps) {
  const [balance, setBalance] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)

    const { peer, peerName, connectedCons, addDataHandler, requesters, addRRHandler } = useConnectionContext()
  

  useEffect(() => {
    const newBalance = blockchain.calculateBalance(pgp.publicKeys, conn.peer)
    setBalance(newBalance)
  }, [blockchain, pgp.publicKeys, conn.peer])

  const handleSendMoney = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Invalid amount", {
        description: "Please enter a valid positive number",
      })
      return
    }

    setIsLoading(true)
    try {
     // await blockchain.sendMoney(conn.peer, Number(amount))
     const transaction = new Transaction(blockchain.ownTransactionIDRef.current, Number(amount), peer.id, conn.peer, null)
     blockchain.incrementOwnTransactionID()
     await transaction.signTransaction(pgp.privateKey)
     blockchain.addPendingTransaction(transaction)
     sendData(
      peer,
      connectedCons,
      transaction.getDataWithSignature(),
      "transaction",
      connectedCons.map((c) => c.peer),
    )
      toast.success("Transaction successful", {
        description: `Successfully sent ${amount} to ${conn.peer}`,
      })
      setAmount("")
      setDialogOpen(false)

      // Update balance after transaction
      const newBalance = blockchain.calculateBalance(pgp.publicKeys, conn.peer)
      setBalance(newBalance)
    } catch (error) {
      toast.error("Transaction failed", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div
        className="p-2 border rounded flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setDialogOpen(true)}
      >
        <div className="flex gap-3 items-center">
          <span className="font-mono text-sm">{conn.peer}</span>
          <p className={`font-mono text-sm ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>{balance}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${conn.open ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} whitespace-nowrap`}
          >
            {conn.open ? "Open" : "Closed"}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connection Details</DialogTitle>
            <DialogDescription>View details and send money to this connection</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Peer ID</h3>
              <p className="font-mono text-sm break-all bg-muted p-2 rounded">{conn.peer}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Connection Status</h3>
              <p className={`text-sm ${conn.open ? "text-green-600" : "text-red-600"}`}>
                {conn.open ? "Connected" : "Disconnected"}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Current Balance</h3>
              <p className={`font-mono text-sm ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>{balance}</p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="text-sm font-medium">Send Money</h3>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="1"
                  />
                  <Button onClick={handleSendMoney} disabled={isLoading || !conn.open} className="gap-2">
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
                {!conn.open && <p className="text-xs text-red-500">Cannot send money to disconnected peer</p>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

