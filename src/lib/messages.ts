import { MinedBlock, MinedBlockData } from "./blocks"

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

//////////////
