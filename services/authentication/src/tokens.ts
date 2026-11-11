import { jwtVerify, SignJWT } from "jose";
import { AuthError } from "./errors";

export interface AccessClaims {
  sub: string; // user id
  sid: string; // session id
  did: string; // device id
}

const ISSUER = "hkfinhub-api";
const AUDIENCE = "hkfinhub-customer";

/** Short-lived HS256 access token. Revocation is checked against the session on every request. */
export async function signAccessToken(secret: Uint8Array, claims: AccessClaims, ttlSeconds: number, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: claims.sid, did: claims.did })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ttlSeconds)
    .sign(secret);
}

export async function verifyAccessToken(secret: Uint8Array, token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || typeof payload["sid"] !== "string" || typeof payload["did"] !== "string") {
      throw new Error("missing claims");
    }
    return { sub: payload.sub, sid: payload["sid"], did: payload["did"] };
  } catch {
    throw new AuthError("SESSION_INVALID", "Your session has ended. Please log in again.");
  }
}

