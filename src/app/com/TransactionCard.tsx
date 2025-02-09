import { useOpenPGPContext } from "@/context/openpgp";
import { Transaction } from "@/lib/transactions";
import { useEffect, useMemo, useState } from "react"

interface TransactionCardProps {
    transaction: Transaction
    publicKeys: Map<string, string>
}

export default function TransactionCard({ transaction, publicKeys }: TransactionCardProps) {
    const [signatureIsValid, setSignatureIsValid] = useState(false);
    const { retrievePublicKeyFromNetwork } = useOpenPGPContext();
    useEffect(() => {
        async function load() {
            const publicKeyOfSender = publicKeys.get(transaction.sender);
            if (!publicKeyOfSender) {
                // return false;
                console.log("Did not find public key of sender:", transaction.sender, ". Asking network...");
                const publicKey = await retrievePublicKeyFromNetwork(transaction.sender);
                console.log("Received public key:", publicKey);
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