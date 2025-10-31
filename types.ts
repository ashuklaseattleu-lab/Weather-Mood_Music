/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface Prompt {
  readonly promptId: string;
  text: string;
  weight: number;
  color: string;
  cc?: number;
}

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';

export interface ControlChange {
  cc: number;
  value: number;
  channel: number;
}

export interface TranscriptMessage {
  speaker: 'user' | 'model' | 'system';
  text: string;
  links?: { uri: string; title: string; }[];
}