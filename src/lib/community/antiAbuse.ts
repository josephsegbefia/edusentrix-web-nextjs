// src/lib/community/antiAbuse.ts
/**
 * Anti-abuse utilities for community polls and donations.
 * Detects suspicious patterns and prevents duplicate/fraudulent activity.
 */
import crypto from "crypto";
import mongoose from "mongoose";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import { FundraisingDonation } from "@/models/FundraisingDonation";

// ============================================================================
// Types
// ============================================================================

export interface VoterIdentity {
  userId?: string;
  householdId?: string;
  ip?: string;
  deviceFingerprint?: string;
}

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface VotingPatternAnalysis {
  suspiciousPatterns: string[];
  riskScore: number;
  details: {
    rapidVotingDetected: boolean;
    duplicateIpCount: number;
    duplicateDeviceCount: number;
  };
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a consistent hash for voter identification.
 * Uses userId or householdId to ensure one vote per eligible voter.
 */
export function generateVoterHash(identity: VoterIdentity): string {
  const key = identity.userId || identity.householdId || "";
  if (!key) {
    throw new Error("Cannot generate voter hash: no userId or householdId provided");
  }
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Generate an IP hash for tracking.
 */
export function generateIpHash(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Generate a device fingerprint hash.
 */
export function generateDeviceHash(fingerprint: string): string {
  return crypto.createHash("sha256").update(fingerprint).digest("hex");
}

// ============================================================================
// Vote Abuse Detection
// ============================================================================

/**
 * Check if a voter can submit a vote for a poll.
 */
export async function canSubmitVote(
  pollId: string,
  schoolId: string,
  identity: VoterIdentity
): Promise<AbuseCheckResult> {
  const warnings: string[] = [];
  let riskLevel: "low" | "medium" | "high" = "low";

  // Generate voter hash
  const voterHash = generateVoterHash(identity);

  // Check for existing vote
  const existingVote = await CommunityPollVote.findOne({
    pollId: new mongoose.Types.ObjectId(pollId),
    voterHash,
  }).lean();

  if (existingVote) {
    return {
      allowed: false,
      reason: "You have already voted on this poll",
      warnings: [],
      riskLevel: "low",
    };
  }

  // Check for suspicious IP patterns
  if (identity.ip) {
    const ipHash = generateIpHash(identity.ip);
    const recentVotesFromIp = await CommunityPollVote.countDocuments({
      pollId: new mongoose.Types.ObjectId(pollId),
      ipHash,
      submittedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    });

    if (recentVotesFromIp >= 5) {
      warnings.push("Multiple votes detected from same network");
      riskLevel = "medium";
    }
    if (recentVotesFromIp >= 10) {
      riskLevel = "high";
    }
  }

  // Check for suspicious device patterns
  if (identity.deviceFingerprint) {
    const deviceHash = generateDeviceHash(identity.deviceFingerprint);
    const recentVotesFromDevice = await CommunityPollVote.countDocuments({
      pollId: new mongoose.Types.ObjectId(pollId),
      deviceFingerprint: deviceHash,
      submittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    });

    if (recentVotesFromDevice >= 3) {
      warnings.push("Multiple votes detected from same device");
      riskLevel = riskLevel === "high" ? "high" : "medium";
    }
  }

  return {
    allowed: true,
    warnings,
    riskLevel,
  };
}

// ============================================================================
// Voting Pattern Analysis
// ============================================================================

/**
 * Analyze voting patterns for a poll to detect suspicious activity.
 */
export async function analyzeVotingPatterns(
  pollId: string,
  schoolId: string
): Promise<VotingPatternAnalysis> {
  const pollIdObj = new mongoose.Types.ObjectId(pollId);
  const schoolIdObj = new mongoose.Types.ObjectId(schoolId);

  const suspiciousPatterns: string[] = [];
  let riskScore = 0;

  // Get all votes for the poll
  const votes = await CommunityPollVote.find({
    pollId: pollIdObj,
    schoolId: schoolIdObj,
  })
    .select("submittedAt ipHash deviceFingerprint")
    .sort({ submittedAt: 1 })
    .lean();

  // Detect rapid voting (many votes in short time)
  let rapidVotingDetected = false;
  const votesPerMinute = new Map<number, number>();
  for (const vote of votes) {
    const minute = Math.floor(new Date(vote.submittedAt).getTime() / 60000);
    votesPerMinute.set(minute, (votesPerMinute.get(minute) || 0) + 1);
  }

  for (const [, count] of votesPerMinute) {
    if (count >= 20) {
      rapidVotingDetected = true;
      suspiciousPatterns.push(`Burst of ${count} votes in a single minute`);
      riskScore += 30;
    }
  }

  // Detect duplicate IPs
  const ipCounts = new Map<string, number>();
  for (const vote of votes) {
    if (vote.ipHash) {
      ipCounts.set(vote.ipHash, (ipCounts.get(vote.ipHash) || 0) + 1);
    }
  }

  let duplicateIpCount = 0;
  for (const [ip, count] of ipCounts) {
    if (count >= 10) {
      duplicateIpCount++;
      suspiciousPatterns.push(`IP address with ${count} votes`);
      riskScore += 10;
    }
  }

  // Detect duplicate devices
  const deviceCounts = new Map<string, number>();
  for (const vote of votes) {
    if (vote.deviceFingerprint) {
      deviceCounts.set(vote.deviceFingerprint, (deviceCounts.get(vote.deviceFingerprint) || 0) + 1);
    }
  }

  let duplicateDeviceCount = 0;
  for (const [device, count] of deviceCounts) {
    if (count >= 5) {
      duplicateDeviceCount++;
      suspiciousPatterns.push(`Device with ${count} votes`);
      riskScore += 15;
    }
  }

  return {
    suspiciousPatterns,
    riskScore: Math.min(riskScore, 100),
    details: {
      rapidVotingDetected,
      duplicateIpCount,
      duplicateDeviceCount,
    },
  };
}

// ============================================================================
// Donation Abuse Detection
// ============================================================================

/**
 * Check for suspicious donation patterns.
 */
export async function checkDonationAbuse(
  campaignId: string,
  email?: string,
  ip?: string
): Promise<AbuseCheckResult> {
  const warnings: string[] = [];
  let riskLevel: "low" | "medium" | "high" = "low";

  const campaignIdObj = new mongoose.Types.ObjectId(campaignId);
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);

  // Check for rapid donations from same email
  if (email) {
    const recentFromEmail = await FundraisingDonation.countDocuments({
      campaignId: campaignIdObj,
      donorEmail: email.toLowerCase(),
      createdAt: { $gte: lastHour },
    });

    if (recentFromEmail >= 5) {
      warnings.push("Multiple donations from same email in short period");
      riskLevel = "medium";
    }
  }

  // Check for rapid donations from same IP
  if (ip) {
    const ipHash = generateIpHash(ip);
    const recentFromIp = await FundraisingDonation.countDocuments({
      campaignId: campaignIdObj,
      // Note: Would need to add ipHash field to donation model
      createdAt: { $gte: lastHour },
    });

    // For now, just track the count for monitoring
    if (recentFromIp >= 10) {
      warnings.push("High volume of donations from network");
      riskLevel = riskLevel === "medium" ? "high" : "medium";
    }
  }

  return {
    allowed: true,
    warnings,
    riskLevel,
  };
}
