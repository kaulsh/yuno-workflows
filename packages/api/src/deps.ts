import type { PrismaClient } from "@workspace/db-adapter";
import type { ChannelModel, ConfirmChannel } from "@workspace/rmq";

export interface ApiDeps {
  prisma: PrismaClient;
  rmq: ChannelModel;
  publishChannel: ConfirmChannel;
}
