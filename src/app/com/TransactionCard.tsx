import { Badge } from "@/components/ui/badge";
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
            <div className="flex items-center gap-2">
                <p>Sender:</p>
                <Badge variant="outline">{transaction.sender}</Badge>
            </div>
            <div className="flex items-center gap-2">
                <p>Receiver:</p>
                <Badge variant="outline">{transaction.receiver}</Badge>
            </div>
            <div className="flex items-center gap-2">
                <p>Amount:</p>
                <Badge variant="secondary">{transaction.amount}</Badge>
            </div>
            <h1 className="text-lg font-bold">Checks</h1>
            <Badge variant={signatureIsValid ? "success" : "destructive"}>{transaction.sender == "system" ? "System transaction" : signatureIsValid ? "Signature is valid" : "Signature is not valid"}</Badge>
        </div>
    )
}