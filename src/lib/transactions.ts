import { Data } from "@/app/com/page";
import { clear } from "console";
import { createCleartextMessage, readCleartextMessage, readKey, readPrivateKey, sign, verify } from "openpgp";

export interface Transaction extends Data {
    // index: number; //TODO: index of block or total?
    amount: number;
    sender: string;
    receiver: string;
}

export interface SignedTransaction extends Data {
    transaction: Transaction;
    signedMessage: string;
}

export async function signTransaction(transaction: Transaction, privateKey: string): Promise<SignedTransaction> {
    const privateKeyObject = await readPrivateKey({ armoredKey: privateKey });
    const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(transaction) });

    const signedMessage = await sign({
        message: unsignedMessage,
        signingKeys: [privateKeyObject],
    });

    return {
        transaction: transaction,
        signedMessage: signedMessage,
    };
}

export async function verifyTransactionSignature(signedTransaction: SignedTransaction, publicKey: string): Promise<boolean> {
    const publicKeyObject = await readKey({ armoredKey: publicKey });
    const cleartextMessage = await readCleartextMessage({ cleartextMessage: signedTransaction.signedMessage });

    if (cleartextMessage.getText() != JSON.stringify(signedTransaction.transaction)) {
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
        // const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(signedTransaction.transaction) });
        console.log("signedText: ", cleartextMessage.getText());
        return cleartextMessage.getText() == JSON.stringify(signedTransaction.transaction);
    }

    return false;
}