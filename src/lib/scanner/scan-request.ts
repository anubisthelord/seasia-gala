import { withBasePath } from "@/config/base-path";

export interface ScannerApiResult {
    success: boolean;
    status: string;
    message: string;
    attendee?: {
      fullName?: string;
      attendeeType?: "EMPLOYEE" | "PARTNER";
    };
  }
  
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  
  export async function submitScannerToken(
    endpoint: string,
    token: string
  ): Promise<ScannerApiResult> {
    const cleanToken = token.trim();
  
    if (!cleanToken) {
      throw new Error("QR code does not contain a valid token.");
    }
  
    const controller = new AbortController();
  
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);
  
    try {
      const response = await fetch(withBasePath(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: cleanToken }),
        signal: controller.signal,
        cache: "no-store",
      });
  
      const responseText = await response.text();
  
      let data: unknown;
  
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Invalid server response. Please try again.");
      }
  
      if (
        !isObject(data) ||
        typeof data.success !== "boolean" ||
        typeof data.status !== "string" ||
        typeof data.message !== "string"
      ) {
        throw new Error("Invalid server response.");
      }
  
      let attendee: ScannerApiResult["attendee"];
  
      if (data.attendee !== undefined && data.attendee !== null) {
        if (!isObject(data.attendee)) {
          throw new Error("Invalid attendee information received.");
        }
  
        const { fullName, attendeeType } = data.attendee;
  
        if (
          fullName !== undefined &&
          typeof fullName !== "string"
        ) {
          throw new Error("Invalid attendee name received.");
        }
  
        if (
          attendeeType !== undefined &&
          attendeeType !== "EMPLOYEE" &&
          attendeeType !== "PARTNER"
        ) {
          throw new Error("Invalid attendee type received.");
        }
  
        attendee = {
          ...(fullName !== undefined && { fullName }),
          ...(attendeeType !== undefined && { attendeeType }),
        };
      }
  
      // Preserve structured failure statuses such as ALREADY_CHECKED_IN
      // even when the API responds with a non-2xx HTTP status.
      return {
        success: data.success,
        status: data.status,
        message: data.message,
        ...(attendee && { attendee }),
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new Error("Request timed out. Please try again.");
      }
  
      if (error instanceof TypeError) {
        throw new Error(
          "Unable to connect to the server. Please check your internet connection."
        );
      }
  
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  

