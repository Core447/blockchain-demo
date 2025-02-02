import { Data } from "@/app/com/page";
import { clear } from "console";
import { createCleartextMessage, readCleartextMessage, readKey, readPrivateKey, sign, verify } from "openpgp";

export interface UnsignedTransactionData {
    index: number | null;
    amount: number;
    sender: string;
    receiver: string;
}

export interface SignedTransactionData extends UnsignedTransactionData {
    signMessage: string | null;
}

export class Transaction {
    index: number | null;
    amount: number;
    sender: string;
    receiver: string;
    signMessage: string | null;

    constructor(index: number | null = null, amount: number, sender: string, receiver: string, signMessage: string | null = null) {
        this.index = index;
        this.amount = amount;
        this.sender = sender;
        this.receiver = receiver;
        this.signMessage = signMessage;
    }

    getDataWithoutSignature(): UnsignedTransactionData {
        return {
            index: this.index,
            amount: this.amount,
            sender: this.sender,
            receiver: this.receiver
        }
    }

    getDataWithSignature(): SignedTransactionData {
        return {
            index: this.index,
            amount: this.amount,
            sender: this.sender,
            receiver: this.receiver,
            signMessage: this.signMessage
        }
    }

    setIndex(index: number) {
        this.index = index;
    }

    async signTransaction(privateKey: string) {
        const data = this.getDataWithoutSignature();
        const privateKeyObject = await readPrivateKey({ armoredKey: privateKey });
        const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(data) });

        this.signMessage = await sign({
            message: unsignedMessage,
            signingKeys: [privateKeyObject],
        });
    }

    async verifyTransactionSignature(publicKey: string): Promise<boolean> {
        if (!this.signMessage) {
            return false;
        }
        const data = this.getDataWithoutSignature();
        const publicKeyObject = await readKey({ armoredKey: publicKey });
        const cleartextMessage = await readCleartextMessage({ cleartextMessage: this.signMessage });
    
        if (cleartextMessage.getText() != JSON.stringify(data)) {
            return false;
        }
    
        const verificationResult = await verify({
            message: cleartextMessage,
            verificationKeys: [publicKeyObject],
        });
    
        // Each signature in the verification result has a "verified" property
        let verified = false;
        try {
            verified = await verificationResult.signatures[0].verified;
        } catch (e) {
            console.log(e);
        }
    
        // Verify the content of the transaction is the same that was signed
        if (verified) {
            // const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(data) });
            console.log("signedText: ", cleartextMessage.getText());
            return cleartextMessage.getText() == JSON.stringify(data);
        }
    
        return false;
    }
}