import { MinedBlock, MinedBlockData } from "./blocks"

export interface RequestOtherPublicKey {
    peer: string
}

export interface ResponseOtherPublicKey {
    publicKey: string
}

export interface RequestAllBlocks {
}

export interface ResponseAllBlocks {
    blocks: MinedBlockData[]
}

//////////////
