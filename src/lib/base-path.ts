export function normalizeBasePath(value: string | undefined): string {
    const trimmedValue = value?.trim();
   
    if (!trimmedValue || trimmedValue === "/") {
      return "";
    }
   
    const withLeadingSlash = trimmedValue.startsWith("/")
      ? trimmedValue
      : `/${trimmedValue}`;
   
    return withLeadingSlash.replace(/\/+$/, "");
  }
   
  export const appBasePath = normalizeBasePath(
    process.env.NEXT_PUBLIC_BASE_PATH,
  );
   
  export function withBasePath(url: string): string {
    if (
      !appBasePath ||
      !url.startsWith("/") ||
      url.startsWith("//") ||
      url === appBasePath ||
      url.startsWith(`${appBasePath}/`)
    ) {
      return url;
    }
   
    return `${appBasePath}${url}`;
  }
   