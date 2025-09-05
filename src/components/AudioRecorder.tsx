import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Download, X, Clock, Upload } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [microphoneStatus, setMicrophoneStatus] = useState<'checking' | 'available' | 'denied' | 'error'>('checking');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const addDebugInfo = (message: string) => {
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Check microphone availability on component mount
  useEffect(() => {
    checkMicrophoneAvailability();
  }, []);

  const checkMicrophoneAvailability = async () => {
    try {
      addDebugInfo('Checking microphone availability...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addDebugInfo('ERROR: getUserMedia not supported in this browser');
        setMicrophoneStatus('error');
        return;
      }

      // Try to get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      addDebugInfo('Microphone access granted');
      
      // Check if we got audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        addDebugInfo('ERROR: No audio tracks found');
        setMicrophoneStatus('error');
        return;
      }
      
      addDebugInfo(`Found microphone: ${audioTracks[0].label || 'Default'}`);
      setMicrophoneStatus('available');
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error: any) {
      addDebugInfo(`ERROR: ${error.name} - ${error.message}`);
      if (error.name === 'NotAllowedError') {
        setMicrophoneStatus('denied');
      } else {
        setMicrophoneStatus('error');
      }
    }
  };
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      addDebugInfo('Starting recording...');
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      addDebugInfo('Got microphone stream');
      
      // Create MediaRecorder - let browser choose the best format
      const mediaRecorder = new MediaRecorder(stream);
      addDebugInfo(`MediaRecorder created with MIME: ${mediaRecorder.mimeType}`);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        addDebugInfo(`Audio data received: ${event.data.size} bytes`);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        addDebugInfo(`Recording stopped. Chunks: ${audioChunksRef.current.length}`);
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        addDebugInfo(`Created audio blob: ${blob.size} bytes`);
        setAudioBlob(blob);
        
        // Create audio URL for playback
        const url = URL.createObjectURL(blob);
        addDebugInfo(`Created audio URL for playback: ${url.substring(0, 50)}...`);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onerror = (event) => {
        addDebugInfo(`MediaRecorder error: ${event}`);
      };
      
      // Start recording with smaller chunks for better real-time feedback
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      addDebugInfo('Recording started successfully');
      
    } catch (error) {
      addDebugInfo(`Recording failed: ${error}`);
      
      // Provide more specific error messages
      if (error instanceof Error && error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error instanceof Error && error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else if (error instanceof Error && error.name === 'NotReadableError') {
        alert('Microphone is being used by another application. Please close other apps using the microphone.');
      } else {
        alert(`Unable to access microphone: ${error instanceof Error ? error.message : error}. Please check your browser permissions and try refreshing the page.`);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      addDebugInfo(`Attempting to play audio: ${audioUrl ? 'URL exists' : 'No URL'}`);
      if (isPlaying) {
        addDebugInfo('Pausing audio playback');
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        addDebugInfo('Starting audio playback');
        audioRef.current.play()
          .then(() => {
            addDebugInfo('Audio playback started successfully');
            setIsPlaying(true);
          })
          .catch((error) => {
            addDebugInfo(`Audio playback failed: ${error.message}`);
            setIsPlaying(false);
          });
      }
    } else {
      addDebugInfo(`Cannot play: audioUrl=${!!audioUrl}, audioRef=${!!audioRef.current}`);
    }
  };

  const downloadRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      // Use appropriate extension based on MIME type
      let extension = 'webm';
      if (audioBlob.type.includes('mp4')) extension = 'm4a';
      else if (audioBlob.type.includes('ogg')) extension = 'ogg';
      else if (audioBlob.type.includes('wav')) extension = 'wav';
      
      a.download = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const processRecording = () => {
    if (audioBlob) {
      // Convert blob to File object with appropriate extension
      let extension = 'webm';
      if (audioBlob.type.includes('mp4')) extension = 'm4a';
      else if (audioBlob.type.includes('ogg')) extension = 'ogg';
      else if (audioBlob.type.includes('wav')) extension = 'wav';
      
      const file = new File([audioBlob], `recording_${Date.now()}.${extension}`, {
        type: audioBlob.type,
        lastModified: Date.now()
      });
      addDebugInfo(`Processing recording: ${file.name} (${file.size} bytes)`);
      onRecordingComplete(file);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md w-full mx-auto px-4 sm:px-0">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center h-[400px] flex flex-col justify-center">
        <Mic className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
        
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
          Record Meeting Audio
        </h2>
        
        <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
          Record your meeting directly in the browser
        </p>

        {/* Microphone Status */}
        <div className="mb-4">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            microphoneStatus === 'available' ? 'bg-green-100 text-green-800' :
            microphoneStatus === 'denied' ? 'bg-red-100 text-red-800' :
            microphoneStatus === 'error' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {microphoneStatus === 'checking' && 'Checking microphone...'}
            {microphoneStatus === 'available' && '✓ Microphone ready'}
            {microphoneStatus === 'denied' && '✗ Microphone access denied'}
            {microphoneStatus === 'error' && '✗ Microphone error'}
          </div>
        </div>

        {/* Debug Information */}
        {debugInfo.length > 0 && (
          <div className="mb-4 p-3 bg-gray-100 rounded-lg text-left">
            <div className="text-xs font-medium text-gray-700 mb-2">Debug Info:</div>
            <div className="space-y-1">
              {debugInfo.map((info, index) => (
                <div key={index} className="text-xs text-gray-600 font-mono">
                  {info}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Recording Controls */}
        {!isRecording && !audioBlob && microphoneStatus === 'available' && (
          <div className="flex justify-center">
            <button
              onClick={startRecording}
              className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg cursor-pointer transition-colors text-sm w-48"
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </button>
          </div>
        )}

        {/* Microphone Access Issues */}
        {microphoneStatus === 'denied' && (
          <div className="space-y-3">
            <div className="text-red-600 text-sm">
              Microphone access was denied. Please:
            </div>
            <ol className="text-xs text-gray-600 text-left space-y-1">
              <li>1. Click the microphone icon in your browser's address bar</li>
              <li>2. Select "Allow" for microphone access</li>
              <li>3. Refresh the page</li>
            </ol>
            <button
              onClick={checkMicrophoneAvailability}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {microphoneStatus === 'error' && (
          <div className="space-y-3">
            <div className="text-red-600 text-sm">
              Microphone error. Please check:
            </div>
            <ol className="text-xs text-gray-600 text-left space-y-1">
              <li>1. Your microphone is connected</li>
              <li>2. No other apps are using the microphone</li>
              <li>3. Browser supports audio recording</li>
            </ol>
            <button
              onClick={checkMicrophoneAvailability}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Check Again
            </button>
          </div>
        )}
        {isRecording && (
          <div className="space-y-4">
            {/* Recording Status */}
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-lg font-mono text-gray-900">
                {formatTime(recordingTime)}
              </span>
              <span className="text-sm text-gray-600">
                {isPaused ? '(Paused)' : '(Recording)'}
              </span>
            </div>

            {/* Recording Controls */}
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={pauseRecording}
                className="flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm"
              >
                {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopRecording}
                className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Recording Preview */}
        {audioBlob && !isRecording && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Recording Complete: {formatTime(recordingTime)}
                </span>
              </div>
              
              {/* Audio Player */}
              <audio
                ref={audioRef}
                src={audioUrl || undefined}
                preload="auto"
                controls={false}
                onEnded={() => setIsPlaying(false)}
                onLoadedData={() => addDebugInfo('Audio loaded and ready to play')}
                onError={(e) => addDebugInfo(`Audio error: ${e.currentTarget.error?.message || 'Unknown error'}`)}
                className="hidden"
              />
              
              {/* Playback Controls */}
              <div className="flex items-center justify-center space-x-3 mb-4">
                <button
                  onClick={playRecording}
                  disabled={!audioUrl}
                  className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={downloadRecording}
                  className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Save
                </button>
                <button
                  onClick={deleteRecording}
                  className="flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </button>
              </div>

              {/* Process Button */}
              <button
                onClick={processRecording}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Transcribe Recording
              </button>
            </div>
          </div>
        )}

        {/* Format Info */}
        <div className="text-xs sm:text-sm text-gray-500 space-y-1 mt-4">
          <p>Recording format: Browser optimized (WebM/M4A)</p>
          <p>Browser microphone access required</p>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;