/**
 * @fileoverview Generates a song depending on the weather near you.
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';
import './components/PromptDjMidi'; // This file now contains WeatherMusicApp
import { WeatherMusicApp } from './components/PromptDjMidi';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'lyria-realtime-exp';

function main() {
  const toastMessage = new ToastMessage();
  // Fix: Cast to unknown first to resolve the type error, as suggested by the compiler.
  document.body.appendChild(toastMessage as unknown as HTMLElement);

  const liveMusicHelper = new LiveMusicHelper(ai, model);

  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const playbackState = customEvent.detail;
    if (playbackState === 'playing') {
      audioAnalyser.start();
    } else {
      audioAnalyser.stop();
    }
  }));

  const app = new WeatherMusicApp(ai, liveMusicHelper);
  // Fix: Cast to unknown first to resolve the type error, as suggested by the compiler.
  document.body.appendChild(app as unknown as HTMLElement);

  liveMusicHelper.addEventListener('error', ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error);
  }));
}

main();