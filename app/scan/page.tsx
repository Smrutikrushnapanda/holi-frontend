'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Camera, User, CheckCircle, XCircle, AlertCircle, RotateCcw, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_BASE } from '@/lib/utils';

type ScanStatus = 'idle' | 'scanning' | 'success' | 'already_used' | 'error';

interface ScanResult {
  success: boolean;
  alreadyUsed: boolean;
  message: string;
  ticket?: {
    ticket_number: string;
    event_name?: string;
    event_place?: string;
    event_date?: string;
    event_time?: string;
    scanned_at?: string;
    scanned_by?: string;
  };
}

export default function ScanPage() {
  const [volunteerName, setVolunteerName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const scannerDivId = 'holi-qr-scanner';
  const lastScanRef = useRef<string>('');
  const cooldownRef = useRef<boolean>(false);

  const startScanner = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const { Html5Qrcode } = await import('html5-qrcode');

    if (scannerRef.current) {
      try {
        await (scannerRef.current as { stop: () => Promise<void> }).stop();
      } catch {
        // already stopped
      }
    }

    const scanner = new Html5Qrcode(scannerDivId);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (cooldownRef.current || decodedText === lastScanRef.current) return;
          cooldownRef.current = true;
          lastScanRef.current = decodedText;

          await handleScan(decodedText);

          setTimeout(() => {
            cooldownRef.current = false;
          }, 3000);
        },
        () => {}
      );
      setScannerReady(true);
    } catch (err) {
      console.error('Camera error:', err);
      setScanStatus('error');
      setScanResult({
        success: false,
        alreadyUsed: false,
        message: 'Camera access denied. Please allow camera permissions.',
      });
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await (scannerRef.current as { stop: () => Promise<void> }).stop();
        scannerRef.current = null;
        setScannerReady(false);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleScan = async (qrData: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setScanStatus('scanning');

    try {
      const { data } = await axios.post<ScanResult>(`${API_BASE}/tickets/scan`, {
        qrData,
        scannedBy: volunteerName || 'Volunteer',
      });

      setScanResult(data);
      if (data.success) {
        setScanStatus('success');
      } else if (data.alreadyUsed) {
        setScanStatus('already_used');
      } else {
        setScanStatus('error');
      }
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Failed to validate ticket. Check your connection.';
      setScanResult({ success: false, alreadyUsed: false, message });
      setScanStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setScanStatus('idle');
    setScanResult(null);
    lastScanRef.current = '';
    cooldownRef.current = false;
    if (!scannerReady) {
      await startScanner();
    }
  };

  if (!nameSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Holi decoration circles */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-400 rounded-full opacity-30 blur-xl" />
          <div className="absolute top-20 right-10 w-16 h-16 bg-pink-400 rounded-full opacity-30 blur-xl" />
          <div className="absolute bottom-20 left-20 w-24 h-24 bg-purple-400 rounded-full opacity-20 blur-xl" />

          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-3xl">🎨</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Holi Festival</h1>
              <p className="text-orange-100 text-sm">2026 · Entry Scanner</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-800">Welcome, Volunteer!</h2>
                <p className="text-sm text-gray-500 mt-1">Enter your name to start scanning tickets</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-orange-500" />
                  Your Name
                </label>
                <Input
                  placeholder="Enter volunteer name..."
                  value={volunteerName}
                  onChange={(e) => setVolunteerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && volunteerName.trim()) {
                      setNameSet(true);
                      setTimeout(startScanner, 300);
                    }
                  }}
                  className="text-base h-12 text-center font-medium"
                  autoFocus
                />
              </div>

              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={() => {
                  setNameSet(true);
                  setTimeout(startScanner, 300);
                }}
                disabled={!volunteerName.trim()}
              >
                <Camera className="w-5 h-5" />
                Start Scanning
              </Button>

              <p className="text-xs text-center text-gray-400">
                Each QR code can only be scanned once
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Holi 2026 · Scanner</p>
            <p className="text-orange-200 text-xs flex items-center gap-1">
              <User className="w-3 h-3" />
              {volunteerName}
            </p>
          </div>
        </div>
        <button
          className="text-orange-200 text-xs underline"
          onClick={() => {
            stopScanner();
            setNameSet(false);
            setScanStatus('idle');
            setScanResult(null);
          }}
        >
          Change
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col">
        {/* QR Camera View */}
        <div className="relative bg-black" style={{ minHeight: '60vw', maxHeight: '70vw' }}>
          <div
            id={scannerDivId}
            className="w-full h-full"
            style={{ minHeight: '60vw', maxHeight: '70vw' }}
          />

          {/* Scanning overlay corners */}
          {scanStatus === 'idle' && scannerReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-48 h-48">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-400 rounded-br-lg" />
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-400 animate-scan-line" />
              </div>
            </div>
          )}

          {scanStatus === 'scanning' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white text-sm">Validating...</p>
              </div>
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div className="flex-1 bg-gray-900 p-5">
          {scanStatus === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                <Camera className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-300 font-medium">Ready to Scan</p>
              <p className="text-gray-500 text-sm max-w-xs">
                Point the camera at the QR code on the ticket
              </p>
              {!scannerReady && (
                <Button variant="outline" size="sm" onClick={startScanner} className="mt-2">
                  <Camera className="w-4 h-4" />
                  Enable Camera
                </Button>
              )}
            </div>
          )}

          {scanStatus === 'success' && scanResult && (
            <div className="space-y-4 animate-in">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-green-400 font-bold text-lg">Entry Allowed!</p>
                  <p className="text-gray-400 text-sm">Ticket validated successfully</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Ticket</span>
                  <span className="text-white font-mono font-bold text-lg">
                    {scanResult.ticket?.ticket_number}
                  </span>
                </div>
                <div className="h-px bg-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Event</span>
                  <span className="text-gray-200 text-sm">{scanResult.ticket?.event_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Date</span>
                  <span className="text-gray-200 text-sm">{scanResult.ticket?.event_date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Venue</span>
                  <span className="text-gray-200 text-sm text-right max-w-[60%]">
                    {scanResult.ticket?.event_place}
                  </span>
                </div>
              </div>

              <Button className="w-full h-12 text-base font-semibold" onClick={handleReset}>
                <Camera className="w-5 h-5" />
                Scan Next Ticket
              </Button>
            </div>
          )}

          {scanStatus === 'already_used' && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
                  <XCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-red-400 font-bold text-lg">Already Used!</p>
                  <p className="text-gray-400 text-sm">This ticket was already scanned</p>
                </div>
              </div>

              <div className="bg-gray-800 border border-red-900 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Ticket</span>
                  <span className="text-red-400 font-mono font-bold text-lg">
                    {scanResult.ticket?.ticket_number}
                  </span>
                </div>
                <div className="h-px bg-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Used at</span>
                  <span className="text-gray-300 text-sm">
                    {scanResult.ticket?.scanned_at
                      ? new Date(scanResult.ticket.scanned_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Unknown'}
                  </span>
                </div>
                {scanResult.ticket?.scanned_by && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Scanned by</span>
                    <span className="text-gray-300 text-sm">{scanResult.ticket.scanned_by}</span>
                  </div>
                )}
              </div>

              <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-xs leading-relaxed">
                  Do not allow entry. This ticket has already been used.
                </p>
              </div>

              <Button className="w-full h-12 text-base font-semibold" onClick={handleReset}>
                <RotateCcw className="w-5 h-5" />
                Scan Another
              </Button>
            </div>
          )}

          {scanStatus === 'error' && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-amber-400 font-bold text-lg">Invalid Ticket</p>
                  <p className="text-gray-400 text-sm">Could not validate</p>
                </div>
              </div>

              <div className="bg-gray-800 border border-amber-900 rounded-2xl p-4">
                <p className="text-gray-300 text-sm">{scanResult.message}</p>
              </div>

              <Button className="w-full h-12 text-base font-semibold" onClick={handleReset}>
                <RotateCcw className="w-5 h-5" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
