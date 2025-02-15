import { useOpenPGPContext } from "@/context/openpgp";
import { MinedBlock } from "@/lib/blocks";
import { Transaction } from "@/lib/transactions";
import { useEffect, useMemo, useState } from "react"

interface BlockCardProps {
    block: MinedBlock
}

export default function BlockCard({ block }: BlockCardProps) {
    const [isValid, setIsValid] = useState(false);
    const pgp = useOpenPGPContext();

    useEffect(() => {
        async function load() {
            setIsValid(await block.getIsValid(pgp.publicKeys));
        }
        load();
    }, [block, pgp.publicKeys]);

    return (
        <div className="p-2 border rounded mb-2">
            <p>N of transactions: {block.transactions.length}</p>
            <h1 className="text-lg font-bold">Checks</h1>
            <p>{isValid ? "Is valid" : "Is not valid"}</p>
            <p>{block.previousBlock ? "Has previous block" : "Does not have previous block"}</p>
            <p>Hash: {block.getHash().slice(0, 10)}</p>
        </div>
    )
}