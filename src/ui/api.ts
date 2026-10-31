import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as RpcClient from "effect/rpc/RpcClient";
import type * as RpcClientError from "effect/rpc/RpcClientError";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import { Http } from "foldkit";
import { AppRpcs, RPC_PATH } from "../rpc.ts";

/** The typed client for the API's RPC procedures. */
export class AppClient extends Context.Service<
  AppClient,
  RpcClient.FromGroup<typeof AppRpcs, RpcClientError.RpcClientError>
>()("starter/ui/AppClient") {
  /** Builds a client that posts to `url`. Tests point it at an in-memory server. */
  static readonly layerAt = (url: string) =>
    Layer.effect(AppClient, RpcClient.make(AppRpcs)).pipe(
      Layer.provide(RpcClient.layerProtocolHttp({ url })),
      Layer.provide([Http.layer, RpcSerialization.layerJson]),
    );

  /** Posts to the API under the Website's base path, e.g. `/app/api/rpc`. */
  static readonly layer = AppClient.layerAt(`${import.meta.env.BASE_URL}${RPC_PATH.slice(1)}`);
}
