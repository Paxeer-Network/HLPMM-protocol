import express from "express";
import cors from "cors";
import http from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql/resolvers";
import { initDb, closeDb } from "./db";
import { startIndexer, stopIndexer } from "./indexer";
import { startCandleService, stopCandleService } from "./services/candles";
import { startTrendingService, stopTrendingService } from "./services/trending";
import { config } from "./config";

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   HLPMM Protocol Indexer                    ║");
  console.log("║   High-performance subgraph replacement     ║");
  console.log("╚══════════════════════════════════════════════╝");

  // 1. Initialize database
  console.log("[db] Connecting to PostgreSQL and running migrations...");
  await initDb();
  console.log("[db] Ready.");

  // 2. Build GraphQL schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // 3. Create HTTP + WebSocket servers
  const app = express();
  const httpServer = http.createServer(app);

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const serverCleanup = useServer({ schema }, wsServer);

  // 4. Create Apollo Server
  const apollo = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    introspection: true,
    csrfPrevention: false,
  });

  await apollo.start();

  // 5. Mount middleware
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/graphql",
    expressMiddleware(apollo, {
      context: async () => ({}),
    }) as any
  );

  // Health check
  app.get("/health", (_req: any, res: { json: (arg0: { status: string; timestamp: number; }) => void; }) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Subgraph-compatible root (some clients query `/` or `/subgraphs/name/...`)
  app.use(
    "/subgraphs/name/hlpmm-protocol/hlpmm",
    expressMiddleware(apollo, {
      context: async () => ({}),
    }) as any
  );

  // 6. Start HTTP server
  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, config.host, () => resolve());
  });
  console.log(`[server] GraphQL API running at http://${config.host}:${config.port}/graphql`);
  console.log(`[server] WebSocket subscriptions at ws://${config.host}:${config.port}/graphql`);
  console.log(`[server] Subgraph-compatible endpoint at /subgraphs/name/hlpmm-protocol/hlpmm`);

  // 7. Start indexer + services in background
  startIndexer().catch((err) => {
    console.error("[indexer] Fatal error:", err);
  });
  startCandleService().catch((err) => {
    console.error("[candles] Fatal error:", err);
  });
  startTrendingService().catch((err) => {
    console.error("[trending] Fatal error:", err);
  });

  // 8. Graceful shutdown
  const shutdown = async () => {
    console.log("\n[shutdown] Gracefully shutting down...");
    stopIndexer();
    await stopCandleService();
    await stopTrendingService();
    await apollo.stop();
    httpServer.close();
    await closeDb();
    console.log("[shutdown] Done.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
