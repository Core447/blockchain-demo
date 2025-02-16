"use client"

import type { Transaction } from "@/lib/transactions"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

interface TransactionOverviewProps {
  transaction: Transaction
  publicKeys: Map<string, string>
}

export default function TransactionOverview({ transaction, publicKeys }: TransactionOverviewProps) {
  const [signatureIsValid, setSignatureIsValid] = useState(false)

  useEffect(() => {
    async function verifySignature() {
      const publicKeyOfSender = publicKeys.get(transaction.sender)
      if (publicKeyOfSender) {
        const isValid = await transaction.verifyTransactionSignature(publicKeyOfSender)
        setSignatureIsValid(isValid)
      }
    }
    verifySignature()
  }, [transaction, publicKeys])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-medium">From:</span>
            <Badge variant="outline">{transaction.sender}</Badge>
          </div>
          <ArrowRight className="h-4 w-4" />
          <div className="flex items-center gap-2">
            <span className="font-medium">To:</span>
            <Badge variant="outline">{transaction.receiver}</Badge>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Amount:</span>
            <Badge variant="secondary">{transaction.amount}</Badge>
          </div>
          <Badge variant={signatureIsValid ? "success" : "destructive"}>
            {signatureIsValid ? "Valid" : "Invalid"} Signature
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

