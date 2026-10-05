import type { BackgroundJobRequestedEvent } from "./events";
import { getInngestClient } from "./inngest-client";

export type InngestSendResult = { ids: string[] };

export async function sendBackgroundJobEvent(
  event: BackgroundJobRequestedEvent
): Promise<InngestSendResult> {
  const result = await getInngestClient().send(event);
  return { ids: result.ids };
}

export const inngestEventPort = {
  send: sendBackgroundJobEvent,
};
