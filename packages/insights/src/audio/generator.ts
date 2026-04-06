/**
 * Audio generation for insights (stubbed out)
 *
 * ElevenLabs TTS has been removed. These functions are no-ops that
 * preserve the module's public API so callers don't break.
 * Audio generation always reports as disabled, and generate* functions
 * throw if called (they should never be reached because callers
 * check isAudioEnabled()/canGenerateAudio() first).
 */

/**
 * Check if audio generation is enabled.
 * Always returns false now that ElevenLabs has been removed.
 */
export function isAudioEnabled(): boolean {
  return false;
}

/**
 * Generate audio from a script.
 * Stubbed out -- throws because callers should gate on isAudioEnabled().
 */
export async function generateAudio(_script: string): Promise<Buffer> {
  throw new Error("Audio generation is not available (ElevenLabs dependency removed)");
}

/**
 * Generate audio with custom settings.
 * Stubbed out -- throws because callers should gate on isAudioEnabled().
 */
export async function generateAudioWithSettings(
  _script: string,
  _options: {
    voiceId?: string;
    modelId?: string;
    outputFormat?: "mp3_44100_128" | "mp3_22050_32" | "pcm_16000" | "pcm_22050";
  } = {},
): Promise<Buffer> {
  throw new Error("Audio generation is not available (ElevenLabs dependency removed)");
}
