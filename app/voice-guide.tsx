'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attemptRemotePlayback,
  createBriefingRequest,
  createPageStateMessage,
  createVoiceEventState,
  isRemoteAudioReady,
  normalizePageContext,
  releaseRemotePlayback,
  reduceVoiceServerEvent,
} from './realtime-voice.mjs';
import { REALTIME_SESSION_LIMIT_SECONDS } from './realtime-session.mjs';

type VoiceStatus = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'unavailable';
type PlaybackStatus = 'idle' | 'starting' | 'buffering' | 'ready' | 'blocked' | 'paused' | 'failed';
type TranscriptTurn = { speaker: 'player' | 'guide'; text: string };

type VoiceEventState = {
  status: Exclude<VoiceStatus, 'off' | 'unavailable'>;
  turns: TranscriptTurn[];
  playerDraft: string;
  guideDraft: string;
  errorCode: string | null;
};

type VoiceGuideProps = {
  blocked: boolean;
  context: string;
  resetRevision: number;
};

const STATUS_COPY: Record<VoiceStatus, string> = {
  off: 'Mic off',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Try again',
  unavailable: 'Unsupported',
};

const ERROR_COPY: Record<string, string> = {
  permission_denied: 'Microphone permission was not granted. You can keep using the full lab without voice.',
  voice_not_configured: 'The voice service is not configured on this deployment yet.',
  voice_session_limit: 'This demo has reached its short-session limit. Please wait a few minutes and try again.',
  openai_rate_limited: 'The voice service is briefly at capacity. The lab and WebMCP tools still work.',
  voice_connection_timeout: 'Voice took too long to connect. The lab and WebMCP tools still work.',
  unsupported: 'This browser does not support the secure voice connection.',
};

function safeErrorMessage(code: string | null) {
  if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  return 'Voice disconnected safely. The lab and WebMCP tools still work.';
}

const blankVoiceEventState = () => createVoiceEventState() as VoiceEventState;

function playbackCopy(playbackStatus: PlaybackStatus, voiceStatus: VoiceStatus) {
  if (playbackStatus === 'ready' && voiceStatus === 'speaking') {
    return { label: 'Reply audio playing', detail: 'The browser reports that the reply stream is playing.' };
  }
  switch (playbackStatus) {
    case 'starting':
      return { label: 'Speaker starting', detail: 'Connecting secure reply audio.' };
    case 'ready':
      return { label: 'Speaker ready', detail: 'Reply audio is connected.' };
    case 'buffering':
      return { label: 'Reply buffering', detail: 'Waiting for the reply stream to resume.' };
    case 'blocked':
      return { label: 'Audio blocked', detail: 'Select Enable sound to play the guide.' };
    case 'paused':
      return { label: 'Audio paused', detail: 'The browser or audio device paused the reply.' };
    case 'failed':
      return { label: 'Audio needs attention', detail: 'Stop, then start voice again to reconnect reply audio.' };
    default:
      return { label: 'Speaker off', detail: 'Reply audio is off.' };
  }
}

export function VoiceGuide({ blocked, context, resetRevision }: VoiceGuideProps) {
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [playbackRetrying, setPlaybackRetrying] = useState(false);
  const [eventState, setEventState] = useState<VoiceEventState>(blankVoiceEventState);
  const [notice, setNotice] = useState('Ask what to do next. The guide explains; you and the browser agent act.');

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteMediaCleanupRef = useRef<(() => void) | null>(null);
  const connectionAbortRef = useRef<AbortController | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const connectAttemptRef = useRef(0);
  const latestContextRef = useRef(normalizePageContext(context));
  const eventStateRef = useRef(eventState);

  useEffect(() => { latestContextRef.current = normalizePageContext(context); }, [context]);
  useEffect(() => { eventStateRef.current = eventState; }, [eventState]);

  const releaseConnection = useCallback(() => {
    connectAttemptRef.current += 1;
    connectionAbortRef.current?.abort();
    connectionAbortRef.current = null;
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = null;

    const peer = peerRef.current;
    peerRef.current = null;

    const channel = channelRef.current;
    channelRef.current = null;
    if (channel && channel.readyState !== 'closed') channel.close();

    const stream = microphoneRef.current;
    microphoneRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());

    remoteMediaCleanupRef.current?.();
    remoteMediaCleanupRef.current = null;
    const audio = remoteAudioRef.current;
    releaseRemotePlayback(audio);

    peer?.close();
  }, []);

  const stop = useCallback((nextNotice = 'Voice stopped. Microphone and reply audio are off. Captions were cleared and not saved.') => {
    releaseConnection();
    setStatus('off');
    setPlaybackStatus('idle');
    setPlaybackRetrying(false);
    setEventState(blankVoiceEventState());
    setNotice(nextNotice);
  }, [releaseConnection]);

  useEffect(() => () => releaseConnection(), [releaseConnection]);

  useEffect(() => {
    if (!blocked) return;
    if (status === 'connecting' || peerRef.current || microphoneRef.current) {
      stop('Voice paused for the player-controlled lab step.');
    }
  }, [blocked, status, stop]);

  useEffect(() => {
    if (resetRevision === 0) return;
    releaseConnection();
    const resetNoticeTimer = window.setTimeout(() => {
      setStatus('off');
      setPlaybackStatus('idle');
      setPlaybackRetrying(false);
      setEventState(blankVoiceEventState());
      setNotice('Voice stopped with the lab reset.');
    }, 0);
    return () => window.clearTimeout(resetNoticeTimer);
  }, [resetRevision, releaseConnection]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify(createPageStateMessage(context)));
    setNotice('Live page context synced · guide has no action tools');
  }, [context]);

  useEffect(() => {
    if (status !== 'speaking' || !['starting', 'buffering'].includes(playbackStatus)) return;
    const outputStartTimer = window.setTimeout(() => {
      setPlaybackStatus((current) => ['starting', 'buffering'].includes(current) ? 'failed' : current);
    }, 4_000);
    return () => window.clearTimeout(outputStartTimer);
  }, [playbackStatus, status]);

  const playRemoteAudio = useCallback(async (
    audio: HTMLAudioElement,
    peer: RTCPeerConnection,
    attempt: number,
  ) => {
    const source = audio.srcObject;
    const nextStatus = await attemptRemotePlayback(audio, () => (
      attempt === connectAttemptRef.current
      && peerRef.current === peer
      && remoteAudioRef.current === audio
      && audio.srcObject === source
    ));
    if (nextStatus) setPlaybackStatus(nextStatus as PlaybackStatus);
  }, []);

  const retryPlayback = useCallback(() => {
    const audio = remoteAudioRef.current;
    const peer = peerRef.current;
    if (!audio || !peer || !audio.srcObject) {
      setPlaybackStatus('failed');
      return;
    }
    const attempt = connectAttemptRef.current;
    const source = audio.srcObject;
    setPlaybackRetrying(true);
    void playRemoteAudio(audio, peer, attempt).finally(() => {
      if (
        attempt === connectAttemptRef.current
        && peerRef.current === peer
        && remoteAudioRef.current === audio
        && audio.srcObject === source
      ) setPlaybackRetrying(false);
    });
  }, [playRemoteAudio]);

  const begin = useCallback(async () => {
    if (blocked || status === 'connecting') return;
    if (!window.isSecureContext || !window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      setNotice(ERROR_COPY.unsupported);
      return;
    }

    releaseConnection();
    const attempt = connectAttemptRef.current;
    setStatus('connecting');
    setPlaybackStatus('starting');
    setPlaybackRetrying(false);
    setEventState(blankVoiceEventState());
    setNotice('Requesting microphone access…');

    try {
      const remoteAudio = remoteAudioRef.current;
      if (!remoteAudio) throw new Error('voice_audio_unavailable');
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute('playsinline', '');
      remoteAudio.muted = false;
      remoteAudio.volume = 1;

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (attempt !== connectAttemptRef.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneRef.current = microphone;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      microphone.getAudioTracks().forEach((track) => peer.addTrack(track, microphone));

      peer.addEventListener('track', (event) => {
        if (peerRef.current !== peer) {
          event.track.stop();
          return;
        }

        remoteMediaCleanupRef.current?.();
        const nextStream = event.streams[0] ?? new MediaStream([event.track]);
        const isCurrent = () => (
          attempt === connectAttemptRef.current
          && peerRef.current === peer
          && remoteAudioRef.current === remoteAudio
          && remoteAudio.srcObject === nextStream
        );
        const handlePlaying = () => {
          if (isCurrent()) setPlaybackStatus(isRemoteAudioReady(remoteAudio) ? 'ready' : 'buffering');
        };
        const handlePause = () => { if (isCurrent()) setPlaybackStatus('paused'); };
        const handleWaiting = () => { if (isCurrent()) setPlaybackStatus('buffering'); };
        const handleError = () => { if (isCurrent()) setPlaybackStatus('failed'); };
        const handleMute = () => { if (isCurrent()) setPlaybackStatus('buffering'); };
        const handleUnmute = () => {
          if (!isCurrent()) return;
          if (remoteAudio.paused) {
            setPlaybackStatus('paused');
          } else {
            setPlaybackStatus(isRemoteAudioReady(remoteAudio) ? 'ready' : 'buffering');
          }
        };
        const handleEnded = () => { if (isCurrent()) setPlaybackStatus('failed'); };

        remoteAudio.addEventListener('playing', handlePlaying);
        remoteAudio.addEventListener('pause', handlePause);
        remoteAudio.addEventListener('waiting', handleWaiting);
        remoteAudio.addEventListener('stalled', handleWaiting);
        remoteAudio.addEventListener('error', handleError);
        event.track.addEventListener('mute', handleMute);
        event.track.addEventListener('unmute', handleUnmute);
        event.track.addEventListener('ended', handleEnded);
        remoteMediaCleanupRef.current = () => {
          remoteAudio.removeEventListener('playing', handlePlaying);
          remoteAudio.removeEventListener('pause', handlePause);
          remoteAudio.removeEventListener('waiting', handleWaiting);
          remoteAudio.removeEventListener('stalled', handleWaiting);
          remoteAudio.removeEventListener('error', handleError);
          event.track.removeEventListener('mute', handleMute);
          event.track.removeEventListener('unmute', handleUnmute);
          event.track.removeEventListener('ended', handleEnded);
        };

        remoteAudio.srcObject = nextStream;
        setPlaybackStatus(event.track.muted ? 'buffering' : 'starting');
        void playRemoteAudio(remoteAudio, peer, attempt);
      });

      const channel = peer.createDataChannel('oai-events');
      channelRef.current = channel;
      channel.addEventListener('message', (message) => {
        if (peerRef.current !== peer || channelRef.current !== channel) return;
        try {
          const event = JSON.parse(String(message.data));
          const next = reduceVoiceServerEvent(eventStateRef.current, event) as VoiceEventState;
          eventStateRef.current = next;
          setEventState(next);
          setStatus(next.status);
          if (next.status === 'error') {
            releaseConnection();
            setStatus('error');
            setPlaybackStatus('idle');
            setPlaybackRetrying(false);
            setNotice(safeErrorMessage(next.errorCode));
          }
        } catch {
          // Unknown events never interrupt audio or the core lab.
        }
      });
      channel.addEventListener('open', () => {
        if (peerRef.current !== peer || channelRef.current !== channel) return;
        channel.send(JSON.stringify(createPageStateMessage(latestContextRef.current)));
        channel.send(JSON.stringify(createBriefingRequest()));
        setStatus('listening');
        setNotice('Live page context synced · guide has no action tools');
      });
      channel.addEventListener('close', () => {
        if (peerRef.current === peer) stop('Voice connection ended. No captions were saved.');
      });

      peer.addEventListener('connectionstatechange', () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          if (peerRef.current === peer) {
            releaseConnection();
            setStatus('error');
            setPlaybackStatus('idle');
            setPlaybackRetrying(false);
            setNotice('Voice connection ended safely. The lab and WebMCP tools still work.');
          }
        }
      });

      const offer = await peer.createOffer();
      if (attempt !== connectAttemptRef.current) return;
      await peer.setLocalDescription(offer);
      if (attempt !== connectAttemptRef.current) return;

      const connectionAbort = new AbortController();
      connectionAbortRef.current = connectionAbort;
      const response = await fetch('/api/realtime/session', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
        signal: connectionAbort.signal,
      });
      if (attempt !== connectAttemptRef.current) return;
      if (connectionAbortRef.current === connectionAbort) connectionAbortRef.current = null;
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        const error = new Error(payload?.error ?? 'voice_connection_failed');
        error.name = 'VoiceConnectionError';
        throw error;
      }
      const answer = await response.text();
      if (attempt !== connectAttemptRef.current) return;
      if (!answer.startsWith('v=0')) throw new Error('voice_connection_failed');
      await peer.setRemoteDescription({ type: 'answer', sdp: answer });
      if (attempt !== connectAttemptRef.current) return;

      sessionTimerRef.current = window.setTimeout(() => {
        stop('Two-minute demo session complete. Start again whenever you want.');
      }, REALTIME_SESSION_LIMIT_SECONDS * 1000);
    } catch (error) {
      if (attempt !== connectAttemptRef.current) return;
      releaseConnection();
      const permissionDenied = error instanceof DOMException
        && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      const code = permissionDenied
        ? 'permission_denied'
        : error instanceof Error && error.name === 'VoiceConnectionError'
          ? error.message
          : 'voice_connection_failed';
      setStatus('error');
      setPlaybackStatus('idle');
      setPlaybackRetrying(false);
      setNotice(safeErrorMessage(code));
    }
  }, [blocked, playRemoteAudio, releaseConnection, status, stop]);

  const active = ['connecting', 'listening', 'thinking', 'speaking'].includes(status);
  const outputCopy = playbackCopy(playbackStatus, status);
  const actionablePlayback = active && ['blocked', 'paused', 'failed'].includes(playbackStatus);
  const visibleStatus = playbackStatus === 'blocked' && active
    ? 'Audio blocked'
    : playbackStatus === 'paused' && active
      ? 'Audio paused'
      : playbackStatus === 'failed' && active
        ? 'Audio issue'
        : playbackStatus === 'buffering' && status === 'speaking'
          ? 'Reply buffering'
        : playbackStatus === 'starting' && status === 'speaking'
          ? 'Speaker starting'
        : STATUS_COPY[status];
  const partialCaption = eventState.guideDraft || eventState.playerDraft;
  const latestTurns = eventState.turns.slice(-3);

  return (
    <section className={`voice-guide voice-status-${status} voice-playback-${playbackStatus}`} aria-label="Optional OpenAI Realtime voice guide">
      {/* Captions are rendered visibly below for the same spoken content. */}
      <audio ref={remoteAudioRef} className="voice-audio-sink" autoPlay playsInline aria-hidden="true" />
      <div className="voice-guide-topline">
        <div className="voice-identity">
          <span className="voice-orb" aria-hidden="true"><i /><i /><i /><i /></span>
          <div>
            <p>OPENAI REALTIME · OPTIONAL</p>
            <h3>Talk to MCPilot</h3>
          </div>
        </div>
        <span className="voice-live-state" role="status" aria-live="polite">
          <i aria-hidden="true" />{blocked ? 'Paused for trial' : visibleStatus}
        </span>
      </div>

      {active && (
        <div className={`voice-output-state voice-output-${playbackStatus}`}>
          <span aria-hidden="true">{playbackStatus === 'ready' ? '♪' : ['starting', 'buffering'].includes(playbackStatus) ? '◌' : '!'}</span>
          <div>
            <b>{outputCopy.label}</b>
            <small>{outputCopy.detail}</small>
          </div>
          {actionablePlayback && (
            <button
              className="voice-audio-retry"
              type="button"
              onClick={playbackStatus === 'failed' ? begin : retryPlayback}
              disabled={playbackRetrying}
            >
              {playbackRetrying
                ? 'Enabling…'
                : playbackStatus === 'failed'
                  ? 'Reconnect voice'
                  : playbackStatus === 'blocked'
                    ? 'Enable sound'
                    : 'Resume sound'}
            </button>
          )}
        </div>
      )}

      <div className="voice-caption-well">
        {latestTurns.length ? (
          <div className="voice-transcript" role="log" aria-label="Voice guide captions">
            {latestTurns.map((turn, index) => (
              <p key={`${turn.speaker}-${index}-${turn.text.slice(0, 16)}`}>
                <b>{turn.speaker === 'guide' ? 'GUIDE' : 'YOU'}</b>
                <span>{turn.text}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="voice-empty-caption">{notice}</p>
        )}
        {partialCaption && <p className="voice-partial" aria-hidden="true"><b>{eventState.guideDraft ? 'GUIDE' : 'YOU'}</b><span>{partialCaption}</span></p>}
      </div>

      <div className="voice-guide-actions">
        <button
          className={active ? 'voice-stop-button' : 'voice-start-button'}
          type="button"
          onClick={active ? () => stop() : begin}
          disabled={blocked}
        >
          <span aria-hidden="true">{active ? '■' : '●'}</span>
          {active ? 'Stop voice' : status === 'error' ? 'Try voice again' : 'Start voice guide'}
        </button>
        <p><b>EXPLAIN ONLY</b> No play, approval, apply, undo, or check-in tools.</p>
      </div>
      <p className="voice-privacy">Mic audio goes to OpenAI only while connected. Stop ends capture; captions are not saved.</p>
    </section>
  );
}
