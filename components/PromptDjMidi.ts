/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { GoogleGenAI, Type, FunctionDeclaration, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audio';

import './PlayPauseButton';
import type { PlaybackState, Prompt, TranscriptMessage } from '../types';
import { LiveMusicHelper } from '../utils/LiveMusicHelper';

// Define a type for our app's state
type AppState = 'initial' | 'loading' | 'player' | 'error';
type ViewMode = 'music' | 'conversation';
type ConversationState = 'idle' | 'listening' | 'processing' | 'error';
type LyricsState = 'idle' | 'loading' | 'generated';
type SingingState = 'idle' | 'loading' | 'singing';


const COLORS = ['#9900ff', '#5200ff', '#ff25f6', '#2af6de', '#ffdd28', '#3dffab', '#d8ff3e', '#d9b2ff'];

@customElement('weather-music-app')
export class WeatherMusicApp extends LitElement {
  static styles = css`
    :host {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      position: relative;
      color: white;
      text-align: center;
    }
    #background {
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #111;
      transition: background 1s ease-in-out;
    }
    .container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 2rem;
      padding: 2rem;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    h1 {
      font-size: 3rem;
      margin: 0;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    p {
      font-size: 1.2rem;
      margin: 0;
      max-width: 600px;
    }
    button.primary {
      font: inherit;
      font-size: 1.2rem;
      font-weight: 600;
      cursor: pointer;
      color: #000;
      background: #fff;
      border: 2px solid #fff;
      border-radius: 50px;
      padding: 1rem 2rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
      -webkit-font-smoothing: antialiased;
    }
    button.primary:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(255,255,255,0.3);
    }
    button.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .loader {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 2s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .player-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
    .controls-container {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .weather-info {
      background: rgba(0,0,0,0.3);
      padding: 1rem;
      border-radius: 1rem;
    }
    .prompts {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 1rem;
        max-width: 80vw;
    }
    .prompt-tag {
        background: rgba(0,0,0,0.5);
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 500;
        border: 2px solid;
    }
    play-pause-button {
      width: 140px;
      height: 140px;
    }
    .volume-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      position: absolute;
      bottom: 2rem;
    }
    .volume-control input[type="range"] {
      cursor: pointer;
    }

    .lyrics-toggle,
    .conversation-toggle {
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 60px;
        height: 60px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }
    .lyrics-toggle:hover,
    .conversation-toggle:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
    }
    .lyrics-toggle svg,
    .conversation-toggle svg {
        width: 32px;
        height: 32px;
        fill: white;
    }

    .conversation-view {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        padding-bottom: 3rem;
        gap: 1.5rem;
    }
    .transcript {
        width: 100%;
        max-width: 800px;
        flex-grow: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }
    .transcript-message {
        padding: 0.8rem 1.2rem;
        border-radius: 1.2rem;
        max-width: 80%;
        width: fit-content;
        line-height: 1.5;
    }
    .transcript-message.user {
        background: #3498db;
        align-self: flex-end;
        border-bottom-right-radius: 0.2rem;
    }
    .transcript-message.model {
        background: rgba(0,0,0,0.3);
        align-self: flex-start;
        border-bottom-left-radius: 0.2rem;
    }
    .transcript-message.system {
        background: transparent;
        color: #aaa;
        align-self: center;
        font-style: italic;
    }
    .transcript-message a {
      color: #82c5ff;
      text-decoration: none;
      font-weight: bold;
    }
    .transcript-message a:hover {
      text-decoration: underline;
    }
    .divider {
        font-weight: bold;
        margin: 1.5rem 0;
        color: rgba(255,255,255,0.7);
    }
    .zip-container {
        margin-top: -0.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem 2rem;
        background: rgba(0,0,0,0.2);
        border-radius: 1rem;
    }
    .zip-input-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .zip-container p {
        margin-bottom: 0.5rem;
        font-size: 1rem;
    }
    .zip-container input {
        font: inherit;
        font-size: 1.2rem;
        padding: 0.8rem;
        border-radius: 50px;
        border: 2px solid #fff;
        background: rgba(255,255,255,0.1);
        color: white;
        width: 150px;
        text-align: center;
    }
    .zip-container input::placeholder {
        color: #ccc;
        opacity: 0.7;
    }
    .zip-container button.primary {
        padding: 0.8rem 1.5rem;
        font-size: 1.2rem;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
    }
    .modal-content {
      background: rgba(34, 34, 34, 0.9);
      padding: 2rem;
      border-radius: 1rem;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      position: relative;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .modal-content h2 {
      margin: 0;
      text-align: center;
    }
    .modal-close {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: transparent;
      border: none;
      color: white;
      font-size: 2.5rem;
      cursor: pointer;
      line-height: 1;
      padding: 0.5rem;
      opacity: 0.7;
    }
    .modal-close:hover {
      opacity: 1;
    }
    .lyrics-container {
      width: 100%;
      background: rgba(0,0,0,0.3);
      padding: 1.5rem;
      border-radius: 0.5rem;
      overflow-y: auto;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .lyrics-text {
      white-space: pre-wrap;
      font-family: 'Roboto Mono', monospace;
      font-size: 1rem;
      width: 100%;
    }
    .lyrics-container p {
      margin-top: 1rem;
    }
    .modal-footer {
        margin-top: 1rem;
        display: flex;
        justify-content: center;
    }
    .error-message {
        color: #ff8a80;
        margin-top: 1rem;
        text-align: center;
        font-size: 1rem;
    }
  `;

  @state() private appState: AppState = 'initial';
  @state() private playbackState: PlaybackState = 'stopped';
  @state() private errorMessage = '';
  @state() private weatherSummary = '';
  @state() private locationName = '';
  @state() private prompts: Prompt[] = [];
  @state() private viewMode: ViewMode = 'music';
  @state() private conversationState: ConversationState = 'idle';
  @state() private transcript: TranscriptMessage[] = [];
  @state() private zipCode = '';
  @state() private showLyricsModal = false;
  @state() private lyricsState: LyricsState = 'idle';
  @state() private lyrics = '';
  @state() private singingState: SingingState = 'idle';
  @state() private singingError = '';

  @query('.transcript') private transcriptEl!: HTMLDivElement;

  private ai: GoogleGenAI;
  private liveMusicHelper: LiveMusicHelper;
  private currentLatitude?: number;
  private currentLongitude?: number;

  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private outputSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  private singingAudioContext: AudioContext | null = null;
  private singingAudioSource: AudioBufferSourceNode | null = null;


  constructor(ai: GoogleGenAI, liveMusicHelper: LiveMusicHelper) {
    super();
    this.ai = ai;
    this.liveMusicHelper = liveMusicHelper;

    this.liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
        this.playbackState = (e as CustomEvent<PlaybackState>).detail;
    }));

    this.liveMusicHelper.addEventListener('error', ((e: Event) => {
        this.appState = 'error';
        this.errorMessage = (e as CustomEvent<string>).detail;
    }));
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('transcript') && this.transcriptEl) {
      // a little delay to allow the DOM to update before scrolling
      setTimeout(() => {
        this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
      }, 0);
    }
  }

  private async generateFromLocation() {
    this.appState = 'loading';
    try {
      const position = await this.fetchGeolocation();
      this.currentLatitude = position.coords.latitude;
      this.currentLongitude = position.coords.longitude;

      const weather = await this.fetchWeatherSummary(this.currentLatitude, this.currentLongitude);
      await this.generateSoundtrack(weather);

    } catch (error: any) {
      this.appState = 'error';
      this.errorMessage = error.message || 'An unknown error occurred.';
    }
  }

  private async generateFromZip() {
    if (!/^\d{5}$/.test(this.zipCode)) {
        this.appState = 'error';
        this.errorMessage = 'Please enter a valid 5-digit US zip code.';
        return;
    }
    this.appState = 'loading';
    try {
        this.currentLatitude = undefined;
        this.currentLongitude = undefined;

        const weather = await this.fetchWeatherSummary(undefined, undefined, this.zipCode);
        await this.generateSoundtrack(weather);

    } catch (error: any) {
        this.appState = 'error';
        this.errorMessage = 'Could not get weather for that zip code. Please try another one.';
    }
  }

  private async generateSoundtrack(weather: {summary: string, location: string}) {
    this.weatherSummary = weather.summary;
    this.locationName = weather.location;

    const musicPrompts = await this.fetchMusicPrompts(this.weatherSummary);

    const promptsMap = new Map<string, Prompt>();
    this.prompts = musicPrompts.map((promptText, i) => {
        const prompt: Prompt = {
            promptId: `prompt-${i}`,
            text: promptText,
            weight: 1.0 - (i * 0.15), // Assign descending weights
            color: COLORS[i % COLORS.length]
        };
        promptsMap.set(prompt.promptId, prompt);
        return prompt;
    });

    this.liveMusicHelper.setWeightedPrompts(promptsMap);
    this.appState = 'player';
    // Automatically start playing
    this.playPause();
  }

  private fetchGeolocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes
      });
    });
  }

  private async fetchWeatherSummary(lat?: number, lon?: number, zipCode?: string): Promise<{summary: string, location: string}> {
      if (!((lat !== undefined && lon !== undefined) || zipCode)) {
        throw new Error('Location data (coordinates or zip code) must be provided.');
      }

      const locationQuery = zipCode
        ? `the US zip code ${zipCode}`
        : `latitude ${lat} and longitude ${lon}`;
      
      const prompt = `Describe the current weather and location for ${locationQuery}. Format the response as a JSON object with two keys: "summary" (a 2-3 word description, e.g., "Light Rain") and "location" (e.g., "Mountain View, CA").`;
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    location: { type: Type.STRING }
                },
                required: ["summary", "location"]
            }
        }
      });
      
      const jsonText = response.text.trim();
      const weatherData = JSON.parse(jsonText);
      return weatherData;
  }

  private async fetchMusicPrompts(weatherSummary: string): Promise<string[]> {
      const prompt = `The weather is '${weatherSummary}'. Generate 4 diverse and creative musical prompts for a generative music AI. The music should only include Hindi rap fusion and Bollywood dance music. The prompts should be short (2-4 words). Return the result as a JSON array of strings.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
      });
      
      const jsonText = response.text.trim();
      return JSON.parse(jsonText);
  }

  private playPause() {
    this.liveMusicHelper.playPause();
  }

  private handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.liveMusicHelper.setVolume(target.valueAsNumber);
    (this as LitElement).requestUpdate();
  }

  private handleZipInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.zipCode = input.value;
  }
  
  private getWeatherBackground() {
      const weather = this.weatherSummary.toLowerCase();
      if (weather.includes('rain') || weather.includes('drizzle')) {
          return 'linear-gradient(to top, #6a85b6 0%, #bac8e0 100%)';
      }
      if (weather.includes('sun') || weather.includes('clear')) {
          return 'linear-gradient(to top, #37ecba 0%, #72afd3 100%)';
      }
      if (weather.includes('cloud') || weather.includes('overcast')) {
          return 'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)';
      }
      if (weather.includes('snow')) {
          return 'linear-gradient(to top, #d0eafc 0%, #e6dada 100%)';
      }
      if (weather.includes('wind')) {
          return 'linear-gradient(to top, #a1c4fd 0%, #c2e9fb 100%)';
      }
      return 'linear-gradient(to right, #434343 0%, black 100%)';
  }

    // --- Conversation Methods ---

    private async toggleConversation() {
        if (this.viewMode === 'music') {
            if (this.playbackState === 'playing') {
                this.liveMusicHelper.pause();
            }
            this.viewMode = 'conversation';
            this.startConversation();
        } else {
            this.viewMode = 'music';
            await this.stopConversation();
        }
    }

    private async startConversation() {
        this.conversationState = 'listening';
        this.transcript = [];
        this.nextStartTime = 0;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const searchNearbyPlaces: FunctionDeclaration = {
                name: 'searchNearbyPlaces',
                parameters: {
                    type: Type.OBJECT,
                    description: 'Finds nearby places based on a user query.',
                    properties: {
                        query: {
                            type: Type.STRING,
                            description: 'The search query, e.g., "coffee shops" or "parks".',
                        },
                    },
                    required: ['query'],
                },
            };

            this.sessionPromise = this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = this.inputAudioContext!.createMediaStreamSource(this.mediaStream!);
                        this.scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);

                        this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            this.sessionPromise!.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(this.scriptProcessor);
                        this.scriptProcessor.connect(this.inputAudioContext!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => this.handleLiveMessage(message),
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error', e);
                        this.transcript = [...this.transcript, { speaker: 'system', text: `Error: ${e.message}` }];
                        this.conversationState = 'error';
                    },
                    onclose: () => {
                       this.stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [searchNearbyPlaces] }],
                },
            });

        } catch (error: any) {
            console.error('Failed to start conversation', error);
            this.transcript = [...this.transcript, { speaker: 'system', text: `Error: ${error.message}` }];
            this.conversationState = 'error';
        }
    }

    private async stopConversation() {
        this.conversationState = 'idle';
        if (this.sessionPromise) {
            const session = await this.sessionPromise;
            session.close();
        }
        this.mediaStream?.getTracks().forEach(track => track.stop());
        this.scriptProcessor?.disconnect();
        this.inputAudioContext?.close();
        this.outputAudioContext?.close();
        
        this.sessionPromise = null;
        this.mediaStream = null;
        this.scriptProcessor = null;
        this.inputAudioContext = null;
        this.outputAudioContext = null;
    }

    private async handleLiveMessage(message: LiveServerMessage) {
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            this.currentOutputTranscription += text;
        } else if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            this.currentInputTranscription += text;
        }

        if (message.serverContent?.turnComplete) {
            if (this.currentInputTranscription.trim()) {
                this.transcript = [...this.transcript, { speaker: 'user', text: this.currentInputTranscription.trim() }];
            }
            if (this.currentOutputTranscription.trim()) {
                this.transcript = [...this.transcript, { speaker: 'model', text: this.currentOutputTranscription.trim() }];
            }
            this.currentInputTranscription = '';
            this.currentOutputTranscription = '';
        }

        if (message.toolCall?.functionCalls) {
            for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'searchNearbyPlaces') {
                    // Fix: Explicitly convert tool call argument to string to prevent potential type errors.
                    const query = String(fc.args.query);
                    this.transcript = [...this.transcript, { speaker: 'system', text: `Searching for ${query}...` }];
                    const result = await this.executeSearchNearbyPlaces(query);
                    const session = await this.sessionPromise;
                    session.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } },
                    });
                }
            }
        }
        
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
        if (base64Audio && this.outputAudioContext) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), this.outputAudioContext, 24000, 1);
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputAudioContext.destination);
            source.addEventListener('ended', () => { this.outputSources.delete(source); });
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.outputSources.add(source);
        }

        if (message.serverContent?.interrupted) {
            for (const source of this.outputSources.values()) {
                source.stop();
                this.outputSources.delete(source);
            }
            this.nextStartTime = 0;
        }
    }

    private async executeSearchNearbyPlaces(query: string) {
        if (this.currentLatitude === undefined || this.currentLongitude === undefined) {
            return "I'm sorry, I don't have your location to search for nearby places. This feature is only available when you start the app using your location.";
        }

        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Find ${query} near me.`,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: { latLng: { latitude: this.currentLatitude, longitude: this.currentLongitude } },
                },
            },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const links: { uri: string, title: string }[] = [];
        if (groundingChunks) {
            for (const chunk of groundingChunks) {
                if (chunk.maps?.uri && chunk.maps.title) {
                    links.push({ uri: chunk.maps.uri, title: chunk.maps.title });
                }
            }
        }
        
        if (links.length > 0) {
            const lastMessageIndex = this.transcript.length - 1;
            if (this.transcript[lastMessageIndex]?.speaker === 'system') {
                this.transcript.splice(lastMessageIndex, 1); // remove "searching" message
            }
            this.transcript = [...this.transcript, { speaker: 'model', text: response.text, links }];
        }

        return { summary: response.text, places: links };
    }

    private async generateLyrics() {
        if (this.lyricsState === 'loading') return;
    
        this.showLyricsModal = true;
        this.lyricsState = 'loading';
        this.lyrics = '';
    
        try {
          const activePrompts = this.liveMusicHelper.activePrompts.map(p => p.text).join(', ');
          const prompt = `The weather is "${this.weatherSummary}" in ${this.locationName}. The musical mood is described by the following prompts: "${activePrompts}".
          Write song lyrics that fit this weather and mood.
          The style must be a fusion of Hindi Rap and Bollywood Dance Music.
          The lyrics should be in Hinglish (a mix of Hindi and English).
          The lyrics should be creative and catchy.
          Do not include song structure labels like [Chorus], [Verse], etc. Just provide the raw lyrics.`;
    
          const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
          });
    
          this.lyrics = response.text;
          this.lyricsState = 'generated';
        } catch (error: any) {
          console.error('Failed to generate lyrics', error);
          this.lyrics = `Sorry, I was unable to write lyrics at this moment.\nError: ${error.message}`;
          this.lyricsState = 'generated';
        }
    }

    // --- Singing Methods ---

    private async singLyrics() {
        if (this.singingState !== 'idle' || !this.lyrics) return;
    
        this.singingState = 'loading';
        this.singingError = '';
    
        // The instrumental music will continue to play.
    
        try {
          const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: this.lyrics }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
            },
          });
    
          const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Audio) {
            throw new Error('No audio data received from API.');
          }
    
          if (!this.singingAudioContext) {
            this.singingAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
    
          const audioBuffer = await decodeAudioData(decode(base64Audio), this.singingAudioContext, 24000, 1);
          
          this.singingAudioSource = this.singingAudioContext.createBufferSource();
          this.singingAudioSource.buffer = audioBuffer;
          this.singingAudioSource.connect(this.singingAudioContext.destination);
          
          this.singingAudioSource.onended = () => {
            this.singingAudioSource = null;
            this.singingState = 'idle';
          };
    
          this.singingAudioSource.start();
          this.singingState = 'singing';
    
        } catch (error: any) {
          console.error('Failed to generate or play speech', error);
          this.singingError = `Sorry, I couldn't sing that. ${error.message}`;
          this.stopSinging();
        }
    }
    
    private stopSinging() {
        if (this.singingAudioSource) {
          this.singingAudioSource.onended = null;
          this.singingAudioSource.stop();
          this.singingAudioSource = null;
        }
        this.singingState = 'idle';
    }
    
    private handleSingButtonClick() {
        if (this.singingState === 'singing') {
          this.stopSinging();
        } else if (this.singingState === 'idle') {
          this.singLyrics();
        }
    }
    
    private getSingButtonText() {
        switch (this.singingState) {
          case 'idle': return 'Sing Lyrics';
          case 'loading': return 'Warming up...';
          case 'singing': return 'Stop Singing';
        }
    }


  render() {
    const bgStyles = styleMap({
        background: this.appState === 'player' ? this.getWeatherBackground() : '#111'
    });
    
    return html`
        <div id="background" style=${bgStyles}></div>
        <div class="container">
            ${this.renderContent()}
        </div>
        ${this.showLyricsModal ? this.renderLyricsModal() : ''}
    `;
  }
  
  private renderContent() {
    if (this.viewMode === 'conversation') {
        return this.renderConversation();
    }
    switch(this.appState) {
        case 'initial':
            return this.renderInitial();
        case 'loading':
            return this.renderLoading();
        case 'player':
            return this.renderMusicPlayer();
        case 'error':
            return this.renderError();
    }
  }

  private renderInitial() {
    return html`
      <h1>Weather Music</h1>
      <p>An AI-powered music experience that creates a unique soundtrack based on your local weather.</p>
      <button class="primary" @click=${this.generateFromLocation}>Use My Location</button>
      <div class="divider">OR</div>
      <div class="zip-container">
        <p>Enter a US zip code to generate music for that location.</p>
        <div class="zip-input-group">
            <input 
                type="text" 
                placeholder="e.g., 90210" 
                maxlength="5" 
                .value=${this.zipCode} 
                @input=${this.handleZipInput}
                @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.generateFromZip()}
            />
            <button 
                class="primary" 
                @click=${this.generateFromZip}
                ?disabled=${!/^\d{5}$/.test(this.zipCode)}>
                Generate
            </button>
        </div>
      </div>
    `;
  }
  
  private renderLoading() {
    return html`
      <div class="loader"></div>
      <p>Finding your location and composing your soundtrack...</p>
    `;
  }

  private renderMusicPlayer() {
    return html`
      <div class="player-view">
        <div class="weather-info">
            <p>${this.weatherSummary} in ${this.locationName}</p>
        </div>
        <div class="prompts">
            ${this.prompts.map(p => html`
                <div class="prompt-tag" style="border-color: ${p.color}; opacity: ${p.weight}">
                    ${p.text}
                </div>`
            )}
        </div>
        <div class="controls-container">
            <button class="lyrics-toggle" @click=${this.generateLyrics} title="Generate Lyrics">
                ${this.renderLyricsIcon()}
            </button>
            <play-pause-button 
                .playbackState=${this.playbackState} 
                @click=${this.playPause}
            ></play-pause-button>
            <button class="conversation-toggle" @click=${this.toggleConversation} title="Start Conversation">
                ${this.renderMicIcon()}
            </button>
        </div>
      </div>
      <div class="volume-control">
        <span role="img" aria-label="Volume down">🔈</span>
        <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            .value=${this.liveMusicHelper.getVolume()}
            @input=${this.handleVolumeChange}
            aria-label="Volume"
        >
        <span role="img" aria-label="Volume up">🔊</span>
      </div>
    `;
  }

  private renderConversation() {
      return html`
        <div class="conversation-view">
            <div class="transcript">
                ${this.transcript.map(msg => html`
                    <div class="transcript-message ${msg.speaker}">
                        ${msg.text}
                        ${msg.links && msg.links.length > 0 ? html`
                            <p>Here are some places I found:</p>
                            <ul>
                                ${msg.links.map(link => html`<li><a href=${link.uri} target="_blank">${link.title}</a></li>`)}
                            </ul>
                        ` : ''}
                    </div>
                `)}
            </div>
            <button class="conversation-toggle" @click=${this.toggleConversation} title="Stop Conversation">
                ${this.renderMicIcon(this.conversationState === 'listening')}
            </button>
        </div>
      `;
  }

  private renderError() {
      return html`
        <h2>Oops! Something went wrong.</h2>
        <p>${this.errorMessage}</p>
        <button class="primary" @click=${() => this.appState = 'initial'}>Try Again</button>
      `;
  }

  private renderMicIcon(isListening = false) {
    return svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11h-1c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92z"/>
        ${isListening ? svg`<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2">
            <animate attributeName="r" from="10" to="12" dur="1s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="1" to="0" dur="1s" repeatCount="indefinite"/>
        </circle>` : ''}
    </svg>`;
  }

  private renderLyricsIcon() {
    return svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>`;
  }

  private renderLyricsModal() {
    const closeModal = () => {
      this.stopSinging();
      this.showLyricsModal = false;
    };
    return html`
        <div class="modal-overlay" @click=${closeModal}>
            <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
                <button class="modal-close" @click=${closeModal} aria-label="Close lyrics">&times;</button>
                <h2>Your Weather Soundtrack Lyrics</h2>
                <div class="lyrics-container">
                    ${this.lyricsState === 'loading' ?
                        html`<div class="loader"></div><p>Writing your song...</p>` :
                        html`<div class="lyrics-text">${this.lyrics}</div>`
                    }
                </div>
                ${this.lyricsState === 'generated' && this.lyrics ? html`
                    <div class="modal-footer">
                        <button
                            class="primary"
                            @click=${this.handleSingButtonClick}
                            ?disabled=${this.singingState === 'loading'}>
                            ${this.getSingButtonText()}
                        </button>
                    </div>
                ` : ''}
                ${this.singingError ? html`<p class="error-message">${this.singingError}</p>` : ''}
            </div>
        </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'weather-music-app': WeatherMusicApp;
  }
}