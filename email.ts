export function notify(notification: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") {
    fetch(
      "http://maker.ifttt.com/trigger/notify/json/with/key/SiqRRoN-OnAolsmwmhQrG",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notification),
      }
    );
  }
}
