
import "server-only";

import { SignJWT, jwtVerify } from "jose";

const SESSION_DURATION = "30m";

function getSessionKey() {
  const secret = process.env.EMPLOYEE_REGISTRATION_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "EMPLOYEE_REGISTRATION_SESSION_SECRET must contain at least 32 characters."
    );
  }

  return new TextEncoder().encode(secret);
}

export async function createEmployeeRegistrationSession(
  employeeId: string,
  email: string
) {
  return new SignJWT({
    email,
    purpose: "EMPLOYEE_REGISTRATION",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(employeeId)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSessionKey());
}

export async function verifyEmployeeRegistrationSession(
  token: string
) {
  try {
    const { payload } = await jwtVerify(token, getSessionKey());

    if (
      payload.purpose !== "EMPLOYEE_REGISTRATION" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return {
      employeeId: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
