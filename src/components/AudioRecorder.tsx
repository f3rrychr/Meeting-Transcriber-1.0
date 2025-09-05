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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      console.log('Requesting microphone access...');
      
      // First, try to get available audio input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      console.log('Available audio input devices:', audioInputs);
      
      if (audioInputs.length === 0) {
        alert('No microphone devices found. Please connect a microphone and refresh the page.');
        return;
      }

      // Try different audio constraint configurations
      let stream = null;
      const constraintOptions = [
        // Option 1: Simple constraints
        { audio: true },
        // Option 2: Basic constraints with echo cancellation
        { 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        },
        // Option 3: Specific device constraints
        { 
          audio: {
            deviceId: audioInputs[0].deviceId,
            echoCancellation: true,
            noiseSuppression: true
          } 
        }
      ];

      for (let i = 0; i < constraintOptions.length; i++) {
        try {
          console.log(`Trying audio constraints option ${i + 1}:`, constraintOptions[i]);
          stream = await navigator.mediaDevices.getUserMedia(constraintOptions[i]);
          console.log('Successfully got microphone stream with option', i + 1);
          break;
        } catch (err) {
          console.log(`Option ${i + 1} failed:`, err);
          if (i === constraintOptions.length - 1) {
            throw err; // Re-throw the last error if all options fail
          }
        }
      }

      if (!stream) {
        throw new Error('Failed to get microphone stream with all constraint options');
      }

      // Verify we got an audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in the stream');
      }

      console.log('Audio track info:', {
        label: audioTracks[0].label,
        kind: audioTracks[0].kind,
        enabled: audioTracks[0].enabled,
        muted: audioTracks[0].muted,
        readyState: audioTracks[0].readyState
      });
      
      // Test if the microphone is actually working
      if (audioTracks[0].muted || audioTracks[0].readyState !== 'live') {
        console.warn('Microphone track appears to be muted or not live');
      }
      
      // Find the best supported MIME type
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg',
        'audio/mp4'
      ];
      
      let mimeType = 'audio/webm'; // fallback
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('Using MIME type:', mimeType);
          break;
        }
      }
      
      // Test MediaRecorder creation before starting
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
      } catch (err) {
        console.log('Failed to create MediaRecorder with', mimeType, 'trying without mimeType');
        mediaRecorder = new MediaRecorder(stream); // Let browser choose
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length);
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || mimeType });
        console.log('Created blob, size:', blob.size, 'type:', blob.type);
        setAudioBlob(blob);
        
        // Create audio URL for playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
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
      
      console.log('Recording started successfully');
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        alert('Microphone is being used by another application. Please close other apps using the microphone.');
      } else {
        alert(`Unable to access microphone: ${error.message || error}. Please check your browser permissions and try refreshing the page.`);
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
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const downloadRecording = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      // Use .webm extension if that's what we recorded, but indicate it's audio
      const extension = audioBlob.type.includes('webm') ? 'webm' : 'mp3';
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
      // Convert blob to File object
      const extension = audioBlob.type.includes('webm') ? 'webm' : 'mp3';
      const file = new File([audioBlob], `recording_${Date.now()}.${extension}`, {
        type: audioBlob.type,
        lastModified: Date.now()
      });
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

        {/* Recording Controls */}
        {!isRecording && !audioBlob && (
          <div className="flex justify-center">
            <button
              onClick={startRecording}
              className="inline-flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg cursor-pointer transition-colors text-sm w-48"
            >
              <Upload className="w-4 h-4 mr-2" />
              Start Recording
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
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              
              {/* Playback Controls */}
              <div className="flex items-center justify-center space-x-3 mb-4">
                <button
                  onClick={playRecording}
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
          <p>Recording format: WebM/MP3 (Compressed)</p>
          <p>Browser microphone access required</p>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;