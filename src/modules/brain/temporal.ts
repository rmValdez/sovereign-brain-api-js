export function currentDateContextLine(timezone?: string | null): string {
  try {
    const tz = timezone || "UTC";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `Current date context: Today is ${formatter.format(now)} (${tz}).`;
  } catch {
    const now = new Date();
    return `Current date context: Today is ${now.toDateString()} (UTC).`;
  }
}
