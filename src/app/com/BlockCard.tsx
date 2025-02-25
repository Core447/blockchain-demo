"use client"

import { useOpenPGPContext } from "@/context/openpgp"
import type { MinedBlock } from "@/lib/blocks"
import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import TransactionOverview from "./BlockTransactionOverview"
import ValidInvalidBadge from "@/components/common/ValidInvalidBadge"

interface BlockCardProps {
  block: MinedBlock
}

export default function BlockCard({ block }: BlockCardProps) {
  const [isValid, setIsValid] = useState(false)
  const [isHashValid, setIsHashValid] = useState(false)
  const [areTransactionsValid, setAreTransactionsValid] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const pgp = useOpenPGPContext()

  useEffect(() => {
    async function load() {
      setIsHashValid(await block.isHashValid())
      setAreTransactionsValid(await block.areTransactionsValid(pgp.publicKeys))


      setIsValid(await block.getIsValid(pgp.publicKeys))
    }
    load()
  }, [block, pgp.publicKeys])

  const hashPreview = block.getHash().slice(0, 5)

  return (
    <Card className="mb-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            Block #{hashPreview}
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
            <span>Transactions: {block.transactions.length}</span>
            <Badge variant={isValid ? "success" : "destructive"}>{isValid ? "Valid" : "Invalid"}</Badge>
          </div>
          <CollapsibleContent className="space-y-2">
            <p className="text-sm">Previous Block: {block.previousBlock ? "Yes" : "No"}</p>
            <div className="flex justify-between items-center">
              <p>Hash</p>
              <ValidInvalidBadge isValid={isHashValid} />
            </div>
            <div className="flex justify-between items-center">
              <p>Transactions</p>
              <ValidInvalidBadge isValid={areTransactionsValid} />
            </div>
            <p className="text-sm">Full Hash: {block.getHash()}</p>
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Transactions</h3>
              <div className="space-y-2">
                {block.transactions.map((transaction, index) => (
                  <TransactionOverview key={index} transaction={transaction} publicKeys={pgp.publicKeys} />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  )
}

