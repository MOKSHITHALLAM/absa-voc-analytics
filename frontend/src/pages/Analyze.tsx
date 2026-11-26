import { Mic, ScanText, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AnalysisResult } from "../components/AnalysisResult";
import { Button, EmptyState, ErrorNotice, PageHeader, Panel, Tabs, Toggle } from "../components/ui";
import { useToast } from "../context/AppProviders";
import { formatDuration } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { Analysis, Health } from "../services/types";

const EXAMPLES = [
  "The room was spotless and the staff were very helpful.",
  "Great location near the station but the wifi was useless.",
  "The shower was cold and the bathroom smelled of mould.",
  "Breakfast was average and quite expensive for what you get.",
  "We could hear traffic all night, the walls are paper thin.",
];

export function AnalyzePage() {
  const health = useOutletContext<Health | null>();
  const toast = useToast();
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [text, setText] = useState("");
  const [hotel, setHotel] = useState("");
  const [clause, setClause] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);

  // voice recording
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); recRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const run = async (fn: () => Promise<Analysis>) => {
    setBusy(true); setError("");
    try {
      const r = await fn();
      setResult(r);
      if (r.review_id) toast.notify("success", `Saved as review #${r.review_id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const ext = (rec.mimeType || "audio/webm").includes("ogg") ? "ogg" : (rec.mimeType || "").includes("mp4") ? "m4a" : "webm";
        run(() => api.voice(blob, `recording.${ext}`, clause, hotel));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true); setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => {
        if (s >= 59) { stopRec(); }
        return s + 1;
      }), 1000);
    } catch {
      setError("Microphone access was blocked. Allow the microphone in your browser and try again.");
    }
  };
  const stopRec = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    if (recRef.current?.state === "recording") recRef.current.stop();
    setRecording(false);
  };

  return (
    <>
      <PageHeader title="Analyse a review"
        description="Type or speak one hotel review sentence. The trained models detect which of the hotel aspects it talks about and whether it is positive, negative or neutral. Every analysis is saved to the database." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Input" actions={<Tabs value={mode} onChange={setMode} items={[
          { value: "text", label: "Type", icon: <ScanText className="h-3.5 w-3.5" /> },
          { value: "voice", label: "Speak", icon: <Mic className="h-3.5 w-3.5" /> }]} />}>
          {mode === "text" ? (
            <form onSubmit={(e) => { e.preventDefault(); run(() => api.analyze(text, clause, hotel)); }} className="space-y-4">
              <label className="block">
                <span className="label">Review sentence</span>
                <textarea className="field voice min-h-[140px] resize-y !text-[16px]" value={text} maxLength={2000}
                  onChange={(e) => setText(e.target.value)} placeholder="e.g. The staff were lovely but the lift was out of order." />
              </label>
              <div>
                <p className="label">Try an example</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button type="button" key={ex} onClick={() => setText(ex)}
                      className="rounded-full border border-line px-2.5 py-1 text-left text-[12px] text-ink-2 hover:border-brand hover:text-ink">
                      {ex.length > 42 ? ex.slice(0, 40) + "…" : ex}
                    </button>
                  ))}
                </div>
              </div>
              <Shared hotel={hotel} setHotel={setHotel} clause={clause} setClause={setClause} />
              <Button type="submit" variant="primary" loading={busy} disabled={text.trim().split(/\s+/).length < 2} icon={<ScanText className="h-4 w-4" />}>
                Analyse review
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {health && !health.speech_available && (
                <ErrorNotice message="Voice input is not installed on the server. In the backend terminal run: pip install faster-whisper — then restart the backend." />
              )}
              <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-line py-8">
                <button type="button" onClick={recording ? stopRec : startRec} disabled={busy}
                  className={`grid h-20 w-20 place-items-center rounded-full text-white transition ${recording ? "bg-neg animate-pulse" : "bg-brand hover:brightness-110"} disabled:opacity-50`}
                  aria-label={recording ? "Stop recording" : "Start recording"}>
                  {recording ? <Square className="h-7 w-7" /> : <Mic className="h-8 w-8" />}
                </button>
                <p className="num text-sm text-ink-2">{recording ? `Recording ${formatDuration(seconds)} — press to stop` : busy ? "Transcribing…" : "Press to record (up to 60 s)"}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                <Upload className="h-4 w-4" />
                <span className="underline-offset-2 hover:underline">Or upload an audio file (wav, mp3, m4a, webm, ogg)</span>
                <input type="file" accept="audio/*" className="sr-only" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) run(() => api.voice(f, f.name, clause, hotel));
                  e.target.value = "";
                }} />
              </label>
              <Shared hotel={hotel} setHotel={setHotel} clause={clause} setClause={setClause} />
              <p className="text-[12.5px] text-ink-3">Speech is converted to text with Whisper on the server (non-English speech is translated to English), then analysed by the same models.</p>
            </div>
          )}
          {error && <div className="mt-4"><ErrorNotice message={error} /></div>}
        </Panel>

        <Panel title="Result" description={result ? "Aspects are coloured by their sentiment." : undefined}>
          {result ? <AnalysisResult result={result} /> : (
            <EmptyState icon={<ScanText className="h-5 w-5" />} title="Nothing analysed yet">
              Enter a review sentence or record one to see the detected aspects and sentiment here.
            </EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}

function Shared({ hotel, setHotel, clause, setClause }: { hotel: string; setHotel: (v: string) => void; clause: boolean; setClause: (v: boolean) => void }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Hotel name (optional)</span>
        <input className="field" value={hotel} onChange={(e) => setHotel(e.target.value)} maxLength={160} placeholder="e.g. Hotel Aurora" />
      </label>
      <Toggle checked={clause} onChange={setClause} label="Clause mode — score each part of a “…, but …” sentence separately" />
    </div>
  );
}
