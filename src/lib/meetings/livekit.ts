import "server-only";
import { createHmac, randomUUID } from "crypto";

type LiveKitVideoGrant = {
  room?: string;
  roomJoin?: boolean;
  roomCreate?: boolean;
  roomList?: boolean;
  roomAdmin?: boolean;
  canPublish?: boolean;
  canPublishData?: boolean;
  canSubscribe?: boolean;
  canUpdateOwnMetadata?: boolean;
};

type LiveKitTokenOptions = {
  identity?: string;
  name?: string;
  metadata?: string;
  validForSeconds?: number;
  video: LiveKitVideoGrant;
};

type LiveKitRoomOptions = {
  roomName: string;
  metadata?: Record<string, unknown>;
  maxParticipants?: number;
  emptyTimeoutSeconds?: number;
};

type JoinTokenOptions = {
  meetingId: string;
  roomName: string;
  userId: string;
  displayName: string;
  role: "school_admin" | "teacher" | "bursar" | "parent";
  isHost: boolean;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getOptionalInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function normalizeApiUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/** Twirp HTTP API must use https:// (not wss://). */
function getLiveKitHttpApiBase() {
  let url = normalizeApiUrl(getRequiredEnv("LIVEKIT_URL"));
  if (url.startsWith("wss://")) {
    url = `https://${url.slice("wss://".length)}`;
  } else if (url.startsWith("ws://")) {
    url = `http://${url.slice("ws://".length)}`;
  }
  return url;
}

function buildJwt(options: LiveKitTokenOptions) {
  const apiKey = getRequiredEnv("LIVEKIT_API_KEY");
  const apiSecret = getRequiredEnv("LIVEKIT_API_SECRET");
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: options.identity || "edusentrix-livekit",
    iat: now,
    nbf: now - 5,
    exp: now + (options.validForSeconds || 60 * 60),
    name: options.name,
    metadata: options.metadata || "",
    video: options.video,
  };

  const encodedHeader = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = base64UrlJson(payload);
  const signature = createHmac("sha256", apiSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function twirpRoomRequest<T>(
  methodName: "CreateRoom" | "DeleteRoom",
  body: Record<string, unknown>
) {
  const liveKitUrl = getLiveKitHttpApiBase();
  const token = buildJwt({
    validForSeconds: 60,
    video: {
      roomCreate: true,
      roomList: true,
    },
  });

  const response = await fetch(
    `${liveKitUrl}/twirp/livekit.RoomService/${methodName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `LiveKit ${methodName} failed`;
    try {
      const parsed = JSON.parse(raw) as { msg?: string; message?: string };
      message = parsed.msg || parsed.message || message;
    } catch {}
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function isLiveKitConfigured() {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim()
  );
}

export function getLiveKitConnectUrl() {
  const explicit = process.env.LIVEKIT_WS_URL?.trim();
  if (explicit) return explicit;

  const base = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || process.env.LIVEKIT_URL?.trim();
  if (!base) return null;
  if (base.startsWith("ws://") || base.startsWith("wss://")) return base;
  if (base.startsWith("https://")) return `wss://${base.slice("https://".length)}`;
  if (base.startsWith("http://")) return `ws://${base.slice("http://".length)}`;
  return base;
}

export function buildLiveKitRoomName(meetingId: string) {
  return `edusentrix-meeting-${meetingId}`;
}

export async function provisionLiveKitRoom(options: LiveKitRoomOptions) {
  const emptyTimeout =
    options.emptyTimeoutSeconds ?? getOptionalInt("LIVEKIT_MEETING_EMPTY_TIMEOUT_SECONDS", 600);
  const maxParticipants =
    options.maxParticipants ?? getOptionalInt("LIVEKIT_MEETING_MAX_PARTICIPANTS", 32);

  // Twirp JSON uses proto/json names (snake_case) for RoomService.
  const body: Record<string, unknown> = {
    name: options.roomName,
    empty_timeout: emptyTimeout,
    max_participants: maxParticipants,
  };
  if (options.metadata && Object.keys(options.metadata).length > 0) {
    body.metadata = JSON.stringify(options.metadata);
  }

  return twirpRoomRequest<{
    sid?: string;
    name: string;
    metadata?: string;
    max_participants?: number;
  }>("CreateRoom", body);
}

export async function deleteLiveKitRoom(roomName: string) {
  await twirpRoomRequest("DeleteRoom", { room: roomName });
}

export async function issueLiveKitJoinToken(options: JoinTokenOptions) {
  const metadata = JSON.stringify({
    meetingId: options.meetingId,
    userId: options.userId,
    role: options.role,
    isHost: options.isHost,
  });

  const identity = `m_${options.meetingId}_u_${options.userId}_${randomUUID().slice(0, 8)}`;
  const token = buildJwt({
    identity,
    name: options.displayName,
    metadata,
    validForSeconds: getOptionalInt("LIVEKIT_JOIN_TOKEN_TTL_SECONDS", 60 * 60),
    video: {
      room: options.roomName,
      roomJoin: true,
      roomAdmin: options.isHost,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: false,
    },
  });

  return {
    token,
    identity,
    roomName: options.roomName,
    serverUrl: getLiveKitConnectUrl(),
  };
}
