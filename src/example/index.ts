import { serve } from "bun"
import index from "./index.html"

const server = serve({
  port: 3001,
  routes: {
    "/*": index,
  },
})

console.log(`🚀 Server running at ${server.url}`)
