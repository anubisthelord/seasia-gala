import "dotenv/config";

import {
  generateQrToken,
  hashQrToken,
  encryptQrToken,
  decryptQrToken,
  verifyQrToken,
} from "../lib/security/qr-token";

function testQrToken() {
  try {
    const token = generateQrToken();
    const tokenHash = hashQrToken(token);
    const encryptedToken = encryptQrToken(token);

    const decryptedToken = decryptQrToken(encryptedToken);

    console.log("Token generated:", Boolean(token));
    console.log("Token length:", token.length);
    console.log("Hash generated:", tokenHash.length === 64);
    console.log("Encryption successful:", Boolean(encryptedToken));
    console.log("Decryption successful:", decryptedToken === token);
    console.log(
      "Token verification:",
      verifyQrToken(token, tokenHash)
    );
    console.log(
      "Invalid token rejected:",
      !verifyQrToken("invalid-token", tokenHash)
    );
  } catch (error) {
    console.error("QR token test failed:", error);
    process.exitCode = 1;
  }
}

testQrToken();