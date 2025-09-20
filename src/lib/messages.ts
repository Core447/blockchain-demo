import { MinedBlock, MinedBlockData } from "./blocks"
import { SignedTransactionData } from "./transactions"

export interface RequestOtherPublicKey {
    peer: string
}

export interface ResponseOtherPublicKey {
    publicKey: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RequestAllBlocks {
}

export interface ResponseAllBlocks {
    blocks: MinedBlockData[]
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RequestAllPendingTransactions {
}

export interface ResponseAllPendingTransactions {
    transactions: SignedTransactionData[]
}

//////////////
