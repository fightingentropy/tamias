/**
 * Storage utilities for insight audio files
 */
import {
  getVaultSignedUrl,
  removeVaultFile,
  uploadVaultFile,
} from "@tamias/storage";

/**
 * Storage bucket for audio files
 * Uses the existing 'vault' bucket which has RLS policies
 */
const BUCKET = "vault";

/**
 * Default presigned URL expiry (7 days in seconds)
 */
const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/**
 * Generate the storage path for an insight's audio file
 */
export function getAudioPath(teamId: string, insightId: string): string {
  return `${teamId}/insights/${insightId}.mp3`;
}

/**
 * Upload insight audio to storage
 *
 * @param teamId - Team ID (used for path organization)
 * @param insightId - Insight ID (used for filename)
 * @param audioBuffer - MP3 audio data
 * @returns Storage path (not URL) for the uploaded file
 */
export async function uploadInsightAudio(
  teamId: string,
  insightId: string,
  audioBuffer: Buffer,
): Promise<string> {
  const path = getAudioPath(teamId, insightId);

  const { data, error } = await uploadVaultFile({
    path,
    blob: audioBuffer,
    contentType: "audio/mpeg",
    size: audioBuffer.length,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload insight audio: ${error.message}`);
  }

  // Return path only (not URL) - URLs are generated on demand
  return data.path;
}

/**
 * Generate a presigned URL for accessing insight audio
 *
 * @param audioPath - Storage path returned from uploadInsightAudio
 * @param expiresInSeconds - URL expiry time (default: 7 days)
 * @returns Presigned URL for the audio file
 */
export async function getAudioPresignedUrl(
  audioPath: string,
  expiresInSeconds: number = DEFAULT_EXPIRY_SECONDS,
): Promise<string> {
  const { data, error } = await getVaultSignedUrl({
    path: audioPath,
    expireIn: expiresInSeconds,
  });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed URL for audio: ${error?.message || "Unknown error"}`,
    );
  }

  return data.signedUrl;
}

/**
 * Check if audio exists for an insight
 *
 * @param teamId - Team ID
 * @param insightId - Insight ID
 * @returns true if audio file exists
 */
export async function audioExists(
  teamId: string,
  insightId: string,
): Promise<boolean> {
  const path = getAudioPath(teamId, insightId);
  const { data, error } = await getVaultSignedUrl({
    path,
    expireIn: 60,
  });

  return !error && !!data?.signedUrl;
}

/**
 * Delete audio for an insight (for cleanup/regeneration)
 *
 * @param teamId - Team ID
 * @param insightId - Insight ID
 */
export async function deleteInsightAudio(
  teamId: string,
  insightId: string,
): Promise<void> {
  const path = getAudioPath(teamId, insightId);

  const { error } = await removeVaultFile(path);

  if (error) {
    throw new Error(`Failed to delete insight audio: ${error.message}`);
  }
}
