import { SignedTransaction, verifyTransactionSignature } from "@/lib/transactions"
import { useEffect, useMemo, useState } from "react"

interface TransactionCardProps {
    transaction: SignedTransaction
    publicKeys: Map<string, string>
}

export default function TransactionCard({ transaction, publicKeys }: TransactionCardProps) {
    const [signatureIsValid, setSignatureIsValid] = useState(false);
    useEffect(() => {
        async function load() {
            const publicKeyOfSender = publicKeys.get(transaction.transaction.sender);
            if (!publicKeyOfSender) {
                return false;
            }
            // transaction.transaction.amount = 1000;
            setSignatureIsValid(await verifyTransactionSignature(transaction, publicKeyOfSender));
        }
        load();
    }, [transaction, publicKeys]);


    return (
        <div className="p-2 border rounded mb-2">
            <p>Sender: {transaction.transaction.sender}</p>
            <p>Receiver: {transaction.transaction.receiver}</p>
            <p>Amount: {transaction.transaction.amount}</p>
            <h1 className="text-lg font-bold">Checks</h1>
            <p>{signatureIsValid ? "Signature is valid" : "Signature is not valid"}</p>
        </div>
    )
}