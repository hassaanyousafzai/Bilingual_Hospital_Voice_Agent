"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentState, Language } from "@/types";

export type LiveStatus = "idle" | "connecting" | "listening" | "speaking" | "ended";

export interface LiveHandlers {
  onState?: (state: AgentState) => void;
  onTranscript?: (role: "user" | "agent", text: string) => void;
  onTurnComplete?: () => void;
  onStatus?: (status: LiveStatus) => void;
  onError?: (message: string) => void;
}

function floatToPCM16(float32: Float32Array): ArrayBuffer {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function useLiveVoice() {
  const [status, setStatus] = useState<LiveStatus>("idle");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedRef = useRef(false);
  const nextTimeRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const handlersRef = useRef<LiveHandlers>({});
  const speakingRef = useRef(false);

  const setStat = (s: LiveStatus) => {
    setStatus(s);
    handlersRef.current.onStatus?.(s);
  };

  const stopPlayback = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    });
    sourcesRef.current = [];
    nextTimeRef.current = 0;
    speakingRef.current = false;
  }, []);

  const playChunk = useCallback((int16: Int16Array) => {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const start = Math.max(ctx.currentTime + 0.02, nextTimeRef.current);
    src.start(start);
    nextTimeRef.current = start + buf.duration;
    sourcesRef.current.push(src);
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
      if (sourcesRef.current.length === 0 && speakingRef.current) {
        speakingRef.current = false;
        setStat("listening");
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "end" }));
    } catch {
      /* noop */
    }
    try {
      wsRef.current?.close();
    } catch {
      /* noop */
    }
    wsRef.current = null;
    stopPlayback();
    try {
      processorRef.current?.disconnect();
    } catch {
      /* noop */
    }
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    captureCtxRef.current?.close().catch(() => {});
    playCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    playCtxRef.current = null;
    setStat("ended");
  }, [stopPlayback]);

  const connect = useCallback(
    async (language: Language, handlers: LiveHandlers) => {
      handlersRef.current = handlers;
      mutedRef.current = false;
      setStat("connecting");

      // Mic capture at 16 kHz (what the Live API expects).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const CaptureCtx = window.AudioContext || (window as any).webkitAudioContext;
      const captureCtx = new CaptureCtx({ sampleRate: 16000 });
      captureCtxRef.current = captureCtx;
      const playCtx = new CaptureCtx({ sampleRate: 24000 });
      playCtxRef.current = playCtx;
      if (captureCtx.state === "suspended") await captureCtx.resume();
      if (playCtx.state === "suspended") await playCtx.resume();

      const source = captureCtx.createMediaStreamSource(stream);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      const mute = captureCtx.createGain();
      mute.gain.value = 0; // keep the node alive without echoing mic to speakers
      source.connect(processor);
      processor.connect(mute);
      mute.connect(captureCtx.destination);

      // In production set NEXT_PUBLIC_BACKEND_WS to the backend, e.g. wss://your-app.up.railway.app
      // (WebSockets can't go through Vercel's serverless proxy). Locally it defaults to :8000.
      const envWs = process.env.NEXT_PUBLIC_BACKEND_WS?.replace(/\/$/, "");
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = envWs
        ? `${envWs}/api/voice/live?lang=${language}`
        : `${proto}://${window.location.hostname}:8000/api/voice/live?lang=${language}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      processor.onaudioprocess = (e) => {
        if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const data = bufToBase64(floatToPCM16(e.inputBuffer.getChannelData(0)));
        ws.send(JSON.stringify({ type: "audio", data }));
      };

      ws.onmessage = (event) => {
        let m: any;
        try {
          m = JSON.parse(event.data);
        } catch {
          return;
        }
        switch (m.type) {
          case "ready":
            setStat("listening");
            break;
          case "audio":
            if (!speakingRef.current) {
              speakingRef.current = true;
              setStat("speaking");
            }
            playChunk(base64ToInt16(m.data));
            break;
          case "interrupted":
            stopPlayback();
            setStat("listening");
            break;
          case "state":
            handlers.onState?.(m.state as AgentState);
            break;
          case "transcript":
            handlers.onTranscript?.(m.role, m.text);
            break;
          case "turn_complete":
            handlers.onTurnComplete?.();
            if (!speakingRef.current) setStat("listening");
            break;
          case "error":
            handlers.onError?.(m.message || "error");
            break;
        }
      };
      ws.onerror = () => handlers.onError?.("connection_error");
      ws.onclose = () => {
        if (status !== "ended") setStat("ended");
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playChunk, stopPlayback]
  );

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", text }));
    }
  }, []);

  const setMuted = useCallback((m: boolean) => {
    mutedRef.current = m;
  }, []);

  return { status, connect, disconnect, sendText, setMuted };
}
