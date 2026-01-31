import { serve } from "bun"
import index from "./index.html"

const server = serve({
  port: 3001,
  routes: {
    "/*": index,
    "/log": {
      async POST(request) {
        const body = await request.json()
        console.log(JSON.stringify(body))
        return new Response("OK")
      },
    },
  },
})

console.log(`🚀 Server running at ${server.url}`)
