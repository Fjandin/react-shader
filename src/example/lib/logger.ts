// biome-ignore lint/suspicious/noExplicitAny: Allow any here
export function log(...args: any[]) {
  console.log(args)

  //   void fetch("/log", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(args),
  //   }).then((response) => {
  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`)
  //     }
  //     return response.json()
  //   })
}
