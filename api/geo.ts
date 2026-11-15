export default function handler(
  req: { headers?: Record<string, string | string[] | undefined> },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: Record<string, unknown>) => void };
  }
) {
  const rawCountry =
    req?.headers?.['x-vercel-ip-country'] ||
    req?.headers?.['cf-ipcountry'] ||
    req?.headers?.['x-country-code'];
  const country = Array.isArray(rawCountry)
    ? rawCountry[0]
    : typeof rawCountry === 'string' && rawCountry.trim().length > 0
    ? rawCountry.trim().toUpperCase()
    : null;

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({
    country: country || null,
  });
}
