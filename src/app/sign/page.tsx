import { createCleartextMessage, generateKey, PrivateKey, readCleartextMessage, readKey, readPrivateKey, sign, verify } from 'openpgp';

export default async function Page() {
    const { privateKey, publicKey } = await generateKey({
        userIDs: [{ name: 'John Doe', email: 'ZoU3S@example.com' }],
    });
    const privateKeyObject = await readPrivateKey({ armoredKey: privateKey });

    const data = {
        amount: 100
    }

    // Sign data
    const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(data) });
    let signedMessage = await sign({
        message: unsignedMessage,
        signingKeys: [privateKeyObject],
    });


    // signedMessage = signedMessage.replace("100", "200");
    console.log(signedMessage);


    // --- Verification Process ---

    // Read and parse the public key.
    const publicKeyObject = await readKey({ armoredKey: publicKey });

    // Read the cleartext signed message.
    const cleartextMessage = await readCleartextMessage({
        cleartextMessage: signedMessage,
    });

    // Verify the signed message using the public key.
    const verificationResult = await verify({
        message: cleartextMessage,
        verificationKeys: publicKeyObject,
    });

    console.log("cleartextMessage:", cleartextMessage.getText());


    // Each signature in the verification result has a "verified" property that is a Promise.
    try {
        // Await the verification of the first (and in this example, only) signature.
        await verificationResult.signatures[0].verified;
        console.log('Signature is valid!');
    } catch (error) {
        console.error('Signature could not be verified:', error);
    }

    return (
        <div>
            <h1>Private Key</h1>
            <pre>{privateKey}</pre>
            <h1>Public Key</h1>
            <pre>{publicKey}</pre>
        </div>
    );
}