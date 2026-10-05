"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";

interface SpeechRecognitionEvent {
  results: { 0: { transcript: string } }[];
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VoiceInputProps = {
  onResult: (text: string, suggestions: { mood?: string; fluids?: string; nutrition?: string }) => void;
};

const MOOD_KEYWORDS: Record<string, string[]> = {
  happy: ["happy", "cheerful", "good mood", "smiling", "content", "positive", "great", "wonderful", "joyful", "bright"],
  neutral: ["okay", "fine", "normal", "usual", "same", "neutral"],
  concerned: ["worried", "anxious", "upset", "agitated", "restless", "unsettled", "concerned", "nervous"],
  distressed: ["crying", "screaming", "pain", "distressed", "very upset", "aggressive", "violent"],
};

const FLUID_KEYWORDS: Record<string, string[]> = {
  normal: ["drank well", "hydrated", "enough water", "normal fluids", "drinking fine"],
  low: ["not drinking", "little water", "dehydrated", "refused water", "low fluids"],
  refused: ["refused", "wouldn't drink", "no water", "declined"],
};

const NUTRITION_KEYWORDS: Record<string, string[]> = {
  full: ["ate well", "finished meal", "ate everything", "full meal", "good appetite", "ate all"],
  partial: ["ate some", "ate half", "picked at", "little food", "partial"],
  refused: ["refused food", "didn't eat", "wouldn't eat", "no appetite", "declined meal"],
};

export function VoiceInput({ onResult }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SpeechRecognition);
  }, []);

  function extractSuggestions(text: string) {
    const lower = text.toLowerCase();
    let mood: string | undefined;
    let fluids: string | undefined;
    let nutrition: string | undefined;

    for (const [m, keywords] of Object.entries(MOOD_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) { mood = m; break; }
    }
    for (const [f, keywords] of Object.entries(FLUID_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) { fluids = f; break; }
    }
    for (const [n, keywords] of Object.entries(NUTRITION_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) { nutrition = n; break; }
    }

    return { mood, fluids, nutrition };
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      const suggestions = extractSuggestions(transcript);
      setProcessing(true);
      setTimeout(() => {
        onResult(transcript, suggestions);
        setProcessing(false);
      }, 300);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon"
      className={`h-9 w-9 rounded-xl relative ${listening ? "animate-pulse bg-red-500 hover:bg-red-600 border-0" : ""}`}
      onClick={listening ? stopListening : startListening}
      disabled={processing}
      title="Voice input — dictate your care note"
    >
      {processing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : listening ? (
        <MicOff className="h-4 w-4 text-white" />
      ) : (
        <>
          <Mic className="h-4 w-4" />
          <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-primary" />
        </>
      )}
    </Button>
  );
}
