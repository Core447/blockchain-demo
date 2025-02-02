import { Transaction } from "@/lib/transactions";
import { useEffect, useMemo, useState } from "react"

interface TransactionCardProps {
    transaction: Transaction
    publicKeys: Map<string, string>
}

export default function TransactionCard({ transaction, publicKeys }: TransactionCardProps) {
    const [signatureIsValid, setSignatureIsValid] = useState(false);
    useEffect(() => {
        async function load() {
            const publicKeyOfSender = publicKeys.get(transaction.sender);
            if (!publicKeyOfSender) {
                return false;
            }
            setSignatureIsValid(await transaction.verifyTransactionSignature(publicKeyOfSender));
        }
        load();
    }, [transaction, publicKeys]);


    return (
        <div className="p-2 border rounded mb-2">
            <p>Sender: {transaction.sender}</p>
            <p>Receiver: {transaction.receiver}</p>
            <p>Amount: {transaction.amount}</p>
            <h1 className="text-lg font-bold">Checks</h1>
            <p>{signatureIsValid ? "Signature is valid" : "Signature is not valid"}</p>
        </div>
    )
}