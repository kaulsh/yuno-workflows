import {
  PrismaSqlFilter,
  PrismaVectorStore,
} from "@langchain/community/vectorstores/prisma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PrismaClient, Prisma, Memory } from "@workspace/db-adapter";

export interface MemoryItem {
  id: string;
  namespace: string;
  content: string;
  tags: string[];
  createdByAgentId: string;
  createdAt: Date;
}

function makeStore(
  prisma: PrismaClient,
  embeddings: OpenAIEmbeddings,
  filter?: PrismaSqlFilter<Memory>,
): PrismaVectorStore<
  Memory,
  string,
  Record<string, true>,
  PrismaSqlFilter<Memory>
> {
  return new PrismaVectorStore<
    Memory,
    string,
    Record<string, true | symbol>,
    PrismaSqlFilter<Memory>
  >(embeddings, {
    db: prisma,
    prisma: Prisma,
    tableName: "Memory",
    vectorColumnName: "embedding",
    columns: {
      id: PrismaVectorStore.IdColumn,
      content: PrismaVectorStore.ContentColumn,
      namespace: true,
      tags: true,
      createdByAgentId: true,
      createdAt: true,
    },
    ...(filter ? { filter } : {}),
  });
}

export class MemoryService {
  private readonly embeddings: OpenAIEmbeddings;

  constructor(private readonly prisma: PrismaClient) {
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });
  }

  async recall(
    namespace: string,
    query: string,
    k: number,
    strategy: "semantic" | "recency",
  ): Promise<MemoryItem[]> {
    if (strategy === "recency") {
      return this.prisma.memory.findMany({
        where: { namespace },
        orderBy: { createdAt: "desc" },
        take: k,
      });
    }

    const store = makeStore(this.prisma, this.embeddings, {
      namespace: { equals: namespace },
    });

    const docs = await store.similaritySearch(query, k);

    return docs.map((doc) => ({
      id: doc.metadata.id,
      namespace: doc.metadata.namespace,
      content: doc.pageContent,
      tags: doc.metadata.tags ?? [],
      createdByAgentId: doc.metadata.createdByAgentId,
      createdAt: doc.metadata.createdAt,
    }));
  }

  async write(
    namespace: string,
    content: string,
    opts: { tags?: string[]; agentId: string },
  ): Promise<MemoryItem> {
    const record = await this.prisma.memory.create({
      data: {
        namespace,
        content,
        tags: opts.tags ?? [],
        createdByAgentId: opts.agentId,
      },
    });

    const store = makeStore(this.prisma, this.embeddings);

    // addModels issues an UPDATE to populate the embedding column
    await store.addModels([record]);

    return record;
  }
}
