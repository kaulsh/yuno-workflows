export function requireDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(`seed: DATABASE_URL is not set in .env`);
  }
  return url;
}
