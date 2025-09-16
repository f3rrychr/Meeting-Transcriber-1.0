import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../services/database';

const ConnectionStatus: React.FC = () => {
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [envVars, setEnvVars] = useState<{
    url: string | undefined;
    key: string | undefined;
  }>({
    url: undefined,
    key: undefined
  });
  const [connectionDetails, setConnectionDetails] = useState<{
    canReachEdgeFunctions: boolean;
    databaseHealthy: boolean;
    lastError?: string;
  }>({
    canReachEdgeFunctions: false,
    databaseHealthy: false
  });

  useEffect(() => {
    checkConnection();
    checkDatabaseHealth();
  }, []);

  const checkDatabaseHealth = async () => {
    setDatabaseStatus('checking');
    try {
      const healthCheck = await db.healthCheck();
      setDatabaseStatus(healthCheck.isHealthy ? 'healthy' : 'error');
      setConnectionDetails(prev => ({
        ...prev,
        databaseHealthy: healthCheck.isHealthy,
        lastError: healthCheck.error
      }));
    } catch (error) {
      setDatabaseStatus('error');
      setConnectionDetails(prev => ({
        ...prev,
        databaseHealthy: false,
        lastError: error instanceof Error ? error.message : 'Database check failed'
      }));
    }
  };
  const checkConnection = async () => {
    setSupabaseStatus('checking');
    
    // Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    setEnvVars({
      url: supabaseUrl,
      key: supabaseKey
    });

    console.log('Supabase Environment Check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
      keyValue: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'undefined'
    });

    // Enhanced placeholder detection
    const isValidUrl = supabaseUrl && 
      supabaseUrl !== 'your_supabase_project_url' && 
      supabaseUrl !== 'undefined' &&
      supabaseUrl !== 'null' &&
      !supabaseUrl.includes('your_') &&
      !supabaseUrl.includes('placeholder') &&
      supabaseUrl.startsWith('https://');
    
    const isValidKey = supabaseKey && 
      supabaseKey !== 'your_supabase_anon_key' && 
      supabaseKey !== 'undefined' &&
      supabaseKey !== 'null' &&
      !supabaseKey.includes('your_') &&
      !supabaseKey.includes('placeholder') &&
      supabaseKey.startsWith('eyJ');

    if (!isValidUrl || !isValidKey) {
      setSupabaseStatus('disconnected');
      return;
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test edge function connectivity
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/health-check`;
      const edgeResponse = await fetch(edgeFunctionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        }
      });

      // Test actual Supabase connectivity
      const canReachEdgeFunctions = edgeResponse.status !== 404; // 404 means edge functions not deployed
      
      // Test database connectivity
      const { data, error } = await supabase.from('audio_uploads').select('count').limit(1);
      
      setConnectionDetails(prev => ({
        ...prev,
        canReachEdgeFunctions,
        lastError: error?.message
      }));
      
      if (error && !error.message.includes('relation "audio_uploads" does not exist')) {
        console.error('Supabase database connectivity test failed:', error);
        setSupabaseStatus('disconnected');
        return;
      }
      
      console.log('Supabase connectivity test passed');
      setSupabaseStatus('connected');
    } catch (error) {
      console.error('Supabase connectivity test failed:', error);
      setSupabaseStatus('disconnected');
    }
  };

  const getStatusIcon = () => {
    switch (supabaseStatus) {
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (supabaseStatus) {
      case 'checking':
        return 'Checking connection...';
      case 'connected':
        return 'Supabase Connected';
      case 'disconnected':
        return 'Supabase Not Connected';
    }
  };

  const getStatusColor = () => {
    switch (supabaseStatus) {
      case 'checking':
        return 'text-blue-600';
      case 'connected':
        return 'text-green-600';
      case 'disconnected':
        return 'text-red-600';
    }
  };

  // Enhanced placeholder detection (moved outside checkConnection for UI use)
  const isValidUrl = envVars.url && 
    envVars.url !== 'your_supabase_project_url' && 
    envVars.url !== 'undefined' &&
    envVars.url !== 'null' &&
    !envVars.url.includes('your_') &&
    !envVars.url.includes('placeholder') &&
    envVars.url.startsWith('https://');
  
  const isValidKey = envVars.key && 
    envVars.key !== 'your_supabase_anon_key' && 
    envVars.key !== 'undefined' &&
    envVars.key !== 'null' &&
    !envVars.key.includes('your_') &&
    !envVars.key.includes('placeholder') &&
    envVars.key.startsWith('eyJ');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Supabase Connection Status</h3>
      
      <div className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          <button
            onClick={checkConnection}
            className="ml-auto px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Environment Variables Check */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">Environment Variables</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>VITE_SUPABASE_URL:</span>
              <span className={isValidUrl ? 'text-green-600' : 'text-red-600'}>
                {isValidUrl ? '✓ Valid' : envVars.url ? '⚠ Placeholder' : '✗ Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>VITE_SUPABASE_ANON_KEY:</span>
              <span className={isValidKey ? 'text-green-600' : 'text-red-600'}>
                {isValidKey ? '✓ Valid' : envVars.key ? '⚠ Placeholder' : '✗ Missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Database Health Check */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-3">Database Health</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Local Database:</span>
              <span className={databaseStatus === 'healthy' ? 'text-green-600' : databaseStatus === 'error' ? 'text-red-600' : 'text-blue-600'}>
                {databaseStatus === 'checking' && '⏳ Checking...'}
                {databaseStatus === 'healthy' && '✓ Healthy'}
                {databaseStatus === 'error' && '✗ Error'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Edge Functions:</span>
              <span className={connectionDetails.canReachEdgeFunctions ? 'text-green-600' : 'text-amber-600'}>
                {connectionDetails.canReachEdgeFunctions ? '✓ Reachable' : '⚠ Not deployed'}
              </span>
            </div>
            {connectionDetails.lastError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <strong>Last Error:</strong> {connectionDetails.lastError}
              </div>
            )}
          </div>
        </div>
        {/* Connection Details */}
        {envVars.url && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Connection Details</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Project URL: {envVars.url}</p>
              <p>Edge Functions: {envVars.url}/functions/v1/</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {supabaseStatus === 'disconnected' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-amber-900 mb-1">Setup Required</h4>
                <p className="text-sm text-amber-800 mb-2">
                  To use real transcription, you need to connect to Supabase:
                </p>
                <ol className="text-sm text-amber-800 space-y-1 ml-4">
                  <li>1. Click "Connect to Supabase" in the top right corner</li>
                  <li>2. Follow the setup wizard to create/connect your project</li>
                  <li>3. Environment variables will be automatically configured</li>
                  <li>4. Database migrations will be applied automatically</li>
                  <li>5. Edge functions will be deployed</li>
                  <li>6. Add your OpenAI API key in Settings</li>
                </ol>
                {!connectionDetails.canReachEdgeFunctions && isValidUrl && isValidKey && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Environment variables are configured but edge functions may not be deployed yet. 
                      This is normal for new Supabase projects.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {supabaseStatus === 'connected' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-green-900 mb-1">Ready for Real Transcription</h4>
                <p className="text-sm text-green-800">
                  Supabase is connected and edge functions are accessible. 
                  Make sure you have a valid OpenAI API key in Settings to use real transcription.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;