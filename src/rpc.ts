import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import { Greeting, GreetingName, ReservedName } from "./model.ts";

/**
 * The typed RPC contract shared by the API and the UI. Procedure names,
 * payloads, and results are wire contracts: keep them compatible or version
 * them explicitly.
 */
export const RPC_PATH = "/api/rpc";

/** Request bodies above this size get a 413 before any RPC decoding. */
export const MAX_RPC_REQUEST_BYTES = 32 * 1024;

export class AppRpcs extends RpcGroup.make(
  Rpc.make("Greet", {
    payload: { name: GreetingName },
    success: Greeting,
    error: ReservedName,
  }),
) {}
