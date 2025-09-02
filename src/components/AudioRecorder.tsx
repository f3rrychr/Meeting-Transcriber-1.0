import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Download, X, Clock } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
}

type RecordingFormat = 'wav' | 'mp3';

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingFormat, setRecordingFormat] = useState<RecordingFormat>('mp3');
  
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Use webm format which is widely supported, then convert filename based on preference
      const mimeType = 'audio/webm;codecs=opus';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Create audio URL for playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your browser permissions.');
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
      a.download = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${recordingFormat}`;
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
      const file = new File([audioBlob], `recording_${Date.now()}.${recordingFormat}`, {
        type: recordingFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
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
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center min-h-[400px] flex flex-col justify-center">
        <Mic className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
        
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
          Record Meeting Audio
        </h2>
        
        <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
          Record your meeting directly in the browser
        </p>

        {/* Format Selection */}
        {!isRecording && !audioBlob && (
          <div className="mb-6 flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recording Format
            </label>
            <div className="flex justify-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="mp3"
                  checked={recordingFormat === 'mp3'}
                  onChange={(e) => setRecordingFormat(e.target.value as RecordingFormat)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">MP3 (Compressed)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="wav"
                  checked={recordingFormat === 'wav'}
                  onChange={(e) => setRecordingFormat(e.target.value as RecordingFormat)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">WAV (High Quality)</span>
              </label>
            </div>
          </div>
        )}

        {/* Recording Controls */}
        {!isRecording && !audioBlob && (
          <button
            onClick={startRecording}
            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg cursor-pointer transition-colors text-sm"
          >
            Start Recording
          </button>
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
          <p>Recording format: {recordingFormat.toUpperCase()} {recordingFormat === 'wav' ? '(High Quality)' : '(Compressed)'}</p>
          <p>Browser microphone access required</p>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;