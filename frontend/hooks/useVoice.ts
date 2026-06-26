"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@/types";

// ── Browser voice selection (fallback TTS) ───────────────────────────────────
const EN_PREFERRED = [
  "Google US English",
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Samantha",
  "Karen",
];
const AR_PREFERRED = [
  "Google العربية",
  "Microsoft Hamed Online (Natural)",
  "Microsoft Salma Online (Natural)",
  "Majed",
  "Maged",
];

function pickVoice(voices: SpeechSynthesisVoice[], lang: Language): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const prefix = lang === "ar" ? "ar" : "en";
  const preferred = lang === "ar" ? AR_PREFERRED : EN_PREFERRED;
  const langVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix));
  for (const name of preferred) {
    const hit = (langVoices.length ? langVoices : voices).find((v) => v.name === name);
    if (hit) return hit;
  }
  const natural = langVoices.find((v) => /natural|google|online/i.test(v.name));
  return natural ?? langVoices[0] ?? null;
}

function splitForSpeech(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 200) return [clean];
  const parts = clean.match(/[^.!?؟。]+[.!?؟。]?/g) || [clean];
  return parts.map((p) => p.trim()).filter(Boolean);
}

type AnyRecognition = any;
function getRecognitionCtor(): AnyRecognition | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export interface UseVoice {
  ttsSupported: boolean;
  sttSupported: boolean;
  speaking: boolean;
  listening: boolean;
  interim: string;
  primeAudio: () => Promise<void>;
  speak: (text: string, lang: Language, opts?: { onEnd?: () => void; onBargeIn?: () => void }) => void;
  cancelSpeak: () => void;
  startListening: (
    lang: Language,
    handlers: { onFinal: (text: string) => void; onError?: (e: string) => void; onEnd?: () => void },
    options?: { continuous?: boolean; silenceMs?: number }
  ) => void;
  stopListening: () => void;
}

export function useVoice(): UseVoice {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<AnyRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardRef = useRef(false);

  // TTS playback + barge-in detection
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const currentSpeechRef = useRef<{ settle: () => void } | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadActiveRef = useRef(false);

  const sttSupported = getRecognitionCtor() !== null;
  const ttsSupported = true; // neural backend TTS with browser fallback

  // ── Mic + audio context unlock (call this on a user gesture) ───────────────
  const primeAudio = useCallback(async () => {
    try {
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
      if (!analyserRef.current && micStreamRef.current) {
        const src = audioCtxRef.current.createMediaStreamSource(micStreamRef.current);
        const an = audioCtxRef.current.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        analyserRef.current = an;
      }
    } catch {
      /* barge-in unavailable; speaking + recognition still work */
    }
  }, []);

  // ── Voice-activity detection for barge-in ──────────────────────────────────
  const stopVad = useCallback(() => {
    vadActiveRef.current = false;
    if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
    vadRafRef.current = null;
  }, []);

  const startVad = useCallback(
    (onBarge: () => void) => {
      const an = analyserRef.current;
      if (!an) return;
      vadActiveRef.current = true;
      const data = new Uint8Array(an.fftSize);
      const startT = performance.now();
      let voiced = 0;
      const tick = () => {
        if (!vadActiveRef.current) return;
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (performance.now() - startT > 350) {
          // Echo cancellation suppresses the agent's own voice; require a sustained spike.
          if (rms > 0.085) voiced += 1;
          else voiced = Math.max(0, voiced - 1);
          if (voiced >= 5) {
            vadActiveRef.current = false;
            onBarge();
            return;
          }
        }
        vadRafRef.current = requestAnimationFrame(tick);
      };
      vadRafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  // ── Browser fallback speech ────────────────────────────────────────────────
  const browserSpeak = useCallback((text: string, lang: Language, onDone: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const voice = pickVoice(window.speechSynthesis.getVoices(), lang);
    const chunks = splitForSpeech(text);
    let i = 0;
    const next = () => {
      if (i >= chunks.length) {
        onDone();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.lang = lang === "ar" ? "ar-SA" : "en-US";
      if (voice) u.voice = voice;
      u.rate = 1.02;
      u.pitch = 1.0;
      u.onend = () => {
        i += 1;
        next();
      };
      u.onerror = () => {
        i += 1;
        next();
      };
      window.speechSynthesis.speak(u);
    };
    next();
  }, []);

  const cancelSpeak = useCallback(() => {
    stopVad();
    if (currentSpeechRef.current) {
      currentSpeechRef.current.settle();
      currentSpeechRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [stopVad]);

  const speak = useCallback(
    (text: string, lang: Language, opts?: { onEnd?: () => void; onBargeIn?: () => void }) => {
      cancelSpeak();
      if (!text.trim()) {
        opts?.onEnd?.();
        return;
      }
      let settled = false;
      const cleanup = () => {
        stopVad();
        if (audioElRef.current) {
          audioElRef.current.pause();
          audioElRef.current = null;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      };
      const settle = (reason: "end" | "barge" | "cancel") => {
        if (settled) return;
        settled = true;
        cleanup();
        setSpeaking(false);
        currentSpeechRef.current = null;
        if (reason === "end") opts?.onEnd?.();
        else if (reason === "barge") opts?.onBargeIn?.();
      };
      currentSpeechRef.current = { settle: () => settle("cancel") };
      setSpeaking(true);

      const armBarge = () => {
        if (opts?.onBargeIn) startVad(() => settle("barge"));
      };

      (async () => {
        try {
          const res = await fetch("/api/voice/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language: lang }),
          });
          if (!res.ok) throw new Error("tts_unavailable");
          const blob = await res.blob();
          if (settled) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioElRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            settle("end");
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            browserSpeak(text, lang, () => settle("end"));
            armBarge();
          };
          await audio.play();
          armBarge();
        } catch {
          if (settled) return;
          browserSpeak(text, lang, () => settle("end"));
          armBarge();
        }
      })();
    },
    [browserSpeak, cancelSpeak, startVad, stopVad]
  );

  // ── Speech recognition (continuous + silence finalisation) ─────────────────
  const stopListening = useCallback(() => {
    discardRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setInterim("");
  }, []);

  const startListening = useCallback(
    (
      lang: Language,
      handlers: { onFinal: (text: string) => void; onError?: (e: string) => void; onEnd?: () => void },
      options?: { continuous?: boolean; silenceMs?: number }
    ) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        handlers.onError?.("unsupported");
        return;
      }
      cancelSpeak();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      const continuous = options?.continuous ?? true;
      const silenceMs = options?.silenceMs ?? 1400;

      const recognition: AnyRecognition = new Ctor();
      recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
      recognition.interimResults = true;
      recognition.continuous = continuous;
      recognition.maxAlternatives = 1;
      discardRef.current = false;
      let finalText = "";

      const armSilence = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          try {
            recognition.stop();
          } catch {
            /* noop */
          }
        }, silenceMs);
      };

      recognition.onresult = (event: any) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + " ";
          else interimText += res[0].transcript;
        }
        setInterim((finalText + interimText).trim());
        if (finalText.trim()) armSilence();
      };
      recognition.onspeechstart = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };
      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech" && e.error !== "aborted") handlers.onError?.(e.error || "error");
      };
      recognition.onend = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setListening(false);
        setInterim("");
        const text = finalText.trim();
        if (text && !discardRef.current) handlers.onFinal(text);
        discardRef.current = false;
        handlers.onEnd?.();
      };

      recognitionRef.current = recognition;
      setInterim("");
      setListening(true);
      try {
        recognition.start();
      } catch {
        setListening(false);
      }
    },
    [cancelSpeak]
  );

  useEffect(() => {
    return () => {
      stopVad();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ttsSupported,
    sttSupported,
    speaking,
    listening,
    interim,
    primeAudio,
    speak,
    cancelSpeak,
    startListening,
    stopListening,
  };
}
