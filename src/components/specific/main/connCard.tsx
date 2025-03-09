import { BlockChainContextType } from "@/context/blockchain";
import { OpenPGPContextType } from "@/context/openpgp";
import { Blockchain } from "@/lib/blockchain";
import { DataConnection } from "peerjs";
import { useEffect, useState } from "react";

interface ConnCardProps {
    conn: DataConnection
    blockchain: BlockChainContextType
    pgp: OpenPGPContextType
}


export default function ConnCard({conn, blockchain, pgp}: ConnCardProps) {
    const [balance, setBalance] = useState(0);

    useEffect(() => {
      const newBalance = blockchain.calculateBalance(pgp.publicKeys, conn.peer);
      setBalance(newBalance);
    }, [blockchain, pgp.publicKeys, conn.peer]);
    
    return (
        <div className="p-2 border rounded flex items-center justify-between">
        <div className="flex gap-3 items-center">
          <span className="font-mono text-sm">{conn.peer}</span>
          <p className={`font-mono text-sm ${balance >=0 ? 'text-green-500' : 'text-red-500'}`}>{balance}</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${conn.open ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} whitespace-nowrap`}
        >
          {conn.open ? "Open" : "Closed"}
        </span>
      </div>
    );
}