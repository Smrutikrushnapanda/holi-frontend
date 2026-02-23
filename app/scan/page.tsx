'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Camera, CameraOff, User, CheckCircle, XCircle, AlertCircle, RotateCcw, Ticket, Keyboard } from 'lucide-react';
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
  const [scannerReady, setScannerReady] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualTicket, setManualTicket] = useState('');

  const scannerRef    = useRef<unknown>(null);
  const lastScanRef   = useRef<string>('');
  const cooldownRef   = useRef<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const nameLoadedRef = useRef(false);
  const scannerDivId  = 'holi-qr-scanner';

  const volunteerNameRef = useRef(volunteerName);
  useEffect(() => { volunteerNameRef.current = volunteerName; }, [volunteerName]);

  const extractTicketNumber = (data: string): string | null => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.ticket) return String(parsed.ticket).toUpperCase();
    } catch {
      // not JSON — fall through
    }
    const plain = data.trim().toUpperCase();
    return plain || null;
  };

  // ── Core scan handler ─────────────────────────────────────────────────────
  const handleScan = useCallback(async (qrData: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setScanStatus('scanning');

    const ticketNumber = extractTicketNumber(qrData);
    if (!ticketNumber) {
      setScanResult({
        success: false,
        alreadyUsed: false,
        message: 'Ticket number not found in QR / input',
      });
      setScanStatus('error');
      submittingRef.current = false;
      cooldownRef.current = false;
      lastScanRef.current = '';
      return;
    }

    console.log('[Scan] qrData:', qrData);
    console.log('[Scan] validate:', `${API_BASE}/${ticketNumber}`);

    try {
      // Step 1: validate ticket number
      const { data: validation } = await axios.post<ScanResult>(
        `${API_BASE}/${ticketNumber}`,
      );

      console.log('[Scan] validation:', validation);

      if (!validation.success) {
        setScanResult(validation);
        if (validation.alreadyUsed) {
          setScanStatus('already_used');
        } else {
          setScanStatus('error');
        }
        return;
      }

      // Step 2: record entry
      const { data: entry } = await axios.post<ScanResult>(
        `${API_BASE}/entry/${ticketNumber}`,
        {
          scannedBy: volunteerNameRef.current || 'Volunteer',
        }
      );

      console.log('[Scan] entry:', entry);

      setScanResult(entry);
      if (entry.success) {
        setScanStatus('success');
        navigator.vibrate?.([200, 100, 200]);
      } else if (entry.alreadyUsed) {
        setScanStatus('already_used');
        navigator.vibrate?.(500);
      } else {
        setScanStatus('error');
        navigator.vibrate?.(500);
      }

    } catch (err: unknown) {
      console.error('[Scan] error:', err);
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Failed to validate ticket. Check your connection.';
      setScanResult({ success: false, alreadyUsed: false, message });
      setScanStatus('error');
      navigator.vibrate?.(500);
    } finally {
      submittingRef.current = false;
      // ✅ Reset cooldown after every scan so the next ticket can be scanned
      cooldownRef.current = false;
      lastScanRef.current = '';
    }
  }, []);

  // ── Start camera scanner ──────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const { Html5Qrcode } = await import('html5-qrcode');

    if (scannerRef.current) {
      try { await (scannerRef.current as { stop: () => Promise<void> }).stop(); } catch { /* ok */ }
      scannerRef.current = null;
    }

    const scanner = new Html5Qrcode(scannerDivId);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          // Ignore if already processing or same QR scanned consecutively
          if (cooldownRef.current || submittingRef.current) return;
          if (decodedText === lastScanRef.current) return;

          cooldownRef.current = true;
          lastScanRef.current = decodedText;
          navigator.vibrate?.(100);

          // ✅ Auto-submit immediately — no confirm step
          handleScan(decodedText);
        },
        () => {} // per-frame errors — silent
      );
      setScannerReady(true);
    } catch (err) {
      console.error('Camera error:', err);
      setScanStatus('error');
      setScanResult({
        success: false,
        alreadyUsed: false,
        message: 'Camera access denied. Please allow camera permissions or use manual entry below.',
      });
    }
  }, [handleScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await (scannerRef.current as { stop: () => Promise<void> }).stop();
        scannerRef.current = null;
        setScannerReady(false);
      } catch { /* ignore */ }
    }
  }, []);

  // Load volunteer name from localStorage on mount
  useEffect(() => {
    if (nameLoadedRef.current) return;
    nameLoadedRef.current = true;
    const saved = localStorage.getItem('holi-volunteer-name');
    if (saved?.trim()) {
      setVolunteerName(saved);
      setNameSet(true);
      setTimeout(() => startScanner(), 600);
    }
  }, [startScanner]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  const handleSetName = () => {
    if (!volunteerName.trim()) return;
    localStorage.setItem('holi-volunteer-name', volunteerName.trim());
    setNameSet(true);
    setTimeout(startScanner, 400);
  };

  const handleChangeName = () => {
    localStorage.removeItem('holi-volunteer-name');
    stopScanner();
    setNameSet(false);
    setScanStatus('idle');
    setScanResult(null);
    setShowManual(false);
    lastScanRef.current = '';
    cooldownRef.current = false;
    submittingRef.current = false;
  };

  const handleReset = async () => {
    setScanStatus('idle');
    setScanResult(null);
    lastScanRef.current = '';
    cooldownRef.current = false;
    submittingRef.current = false;
    setShowManual(false);
    if (!scannerReady) {
      await startScanner();
    }
  };

  const handleManualSubmit = async () => {
    const ticketNum = manualTicket.trim().toUpperCase();
    if (!ticketNum) return;
    setManualTicket('');
    setShowManual(false);
    await handleScan(ticketNum);
  };

  // ── Welcome / name-entry screen ───────────────────────────────────────────
  if (!nameSet) {
    return (
      <div className="min-h-screen bg-linear-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center p-4">
        <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-400 rounded-full opacity-30 blur-xl" />
        <div className="absolute top-20 right-10 w-16 h-16 bg-pink-400 rounded-full opacity-30 blur-xl" />
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-purple-400 rounded-full opacity-20 blur-xl" />
        <div className="absolute bottom-10 right-20 w-14 h-14 bg-yellow-300 rounded-full opacity-25 blur-xl" />

        <div className="w-full max-w-sm relative">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-linear-to-r from-orange-500 via-pink-500 to-red-500 p-6 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-3xl">🎨</span>
              </div>
              <h1 className="text-2xl font-bold text-white font-festive">Holi Festival 2026 🎨</h1>
              <p className="text-orange-100 text-sm font-festive">Entry Scanner</p>
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
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetName(); }}
                  className="text-base h-12 text-center font-medium"
                  autoFocus
                />
              </div>

              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={handleSetName}
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

  // ── Main scanner screen ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-md mx-auto">

      {/* Header */}
      <div className="bg-linear-to-r from-orange-600 via-pink-600 to-red-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm font-festive">Holi 2026 · Scanner</p>
            <p className="text-orange-200 text-xs flex items-center gap-1">
              <User className="w-3 h-3" />
              {volunteerName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"
            onClick={() => scannerReady ? stopScanner() : startScanner()}
            title={scannerReady ? 'Turn off camera' : 'Turn on camera'}
          >
            {scannerReady
              ? <Camera className="w-4 h-4 text-white" />
              : <CameraOff className="w-4 h-4 text-white/60" />}
          </button>
          <button className="text-orange-200 text-xs underline" onClick={handleChangeName}>
            Change
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">

        {/* ── Camera area ───────────────────────────────────────────────── */}
        <div className="relative bg-black" style={{ height: '300px' }}>

          {/* Camera-off overlay */}
          {!scannerReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950 z-30">
              <CameraOff className="w-12 h-12 text-gray-600" />
              <p className="text-gray-500 text-sm">Camera is off</p>
              <button className="text-orange-400 text-xs underline" onClick={startScanner}>
                Turn on
              </button>
            </div>
          )}

          <div
            id={scannerDivId}
            style={{ width: '100%', height: '300px', position: 'relative' }}
          />

          {/* Scan-box corners — idle & camera ready */}
          {scanStatus === 'idle' && scannerReady && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 20 }}
            >
              <div className="relative" style={{ width: 250, height: 250 }}>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-400 rounded-br-lg" />
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-400 animate-scan-line" />
              </div>
            </div>
          )}

          {/* Validating spinner overlay */}
          {scanStatus === 'scanning' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 20 }}>
              <div className="text-center">
                <div className="w-14 h-14 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white text-sm font-medium">Validating...</p>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {scanStatus === 'success' && (
            <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center" style={{ zIndex: 20 }}>
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/60 animate-bounce">
                <CheckCircle className="w-14 h-14 text-white" />
              </div>
            </div>
          )}

          {/* Already used overlay */}
          {scanStatus === 'already_used' && (
            <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center" style={{ zIndex: 20 }}>
              <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/60 animate-bounce">
                <XCircle className="w-14 h-14 text-white" />
              </div>
            </div>
          )}

          {/* Error overlay */}
          {scanStatus === 'error' && (
            <div className="absolute inset-0 bg-amber-900/30 flex items-center justify-center" style={{ zIndex: 20 }}>
              <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/50">
                <AlertCircle className="w-14 h-14 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* ── Result / idle panel ──────────────────────────────────────── */}
        <div className="flex-1 bg-gray-900 p-5 flex flex-col gap-4">

          {/* IDLE */}
          {scanStatus === 'idle' && (
            <>
              <div className="flex flex-col items-center justify-center gap-3 text-center py-4">
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

              <div className="border-t border-gray-800 pt-4">
                <button
                  className="w-full flex items-center justify-center gap-2 text-gray-400 text-sm hover:text-orange-400 transition-colors"
                  onClick={() => setShowManual(!showManual)}
                >
                  <Keyboard className="w-4 h-4" />
                  {showManual ? 'Hide manual entry' : "Can't scan? Enter ticket number manually"}
                </button>
                {showManual && (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="e.g. HOLI-001"
                      value={manualTicket}
                      onChange={(e) => setManualTicket(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
                      className="bg-gray-800 border-gray-700 text-white text-center text-base h-11 font-mono tracking-wider placeholder:text-gray-600"
                      autoFocus
                    />
                    <Button
                      className="w-full h-11 font-semibold"
                      onClick={handleManualSubmit}
                      disabled={!manualTicket.trim()}
                    >
                      <Ticket className="w-4 h-4" />
                      Validate Ticket
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* SCANNING */}
          {scanStatus === 'scanning' && (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-300 font-medium">Validating ticket...</p>
              <p className="text-gray-500 text-sm">Please wait</p>
            </div>
          )}

          {/* SUCCESS */}
          {scanStatus === 'success' && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-green-400 font-bold text-xl">✅ Entry Allowed!</p>
                  <p className="text-gray-400 text-sm">Ticket validated successfully</p>
                </div>
              </div>
              <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Ticket</span>
                  <span className="text-white font-mono font-bold text-lg">{scanResult.ticket?.ticket_number}</span>
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
                  <span className="text-gray-200 text-sm text-right max-w-[60%]">{scanResult.ticket?.event_place}</span>
                </div>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                onClick={handleReset}
              >
                <Camera className="w-5 h-5" />
                Scan Next Ticket
              </Button>
            </div>
          )}

          {/* ALREADY USED */}
          {scanStatus === 'already_used' && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
                  <XCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-red-400 font-bold text-xl">🚫 Already Scanned!</p>
                  <p className="text-gray-400 text-sm">This ticket was already used</p>
                </div>
              </div>
              <div className="bg-gray-800 border border-red-900 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Ticket</span>
                  <span className="text-red-400 font-mono font-bold text-lg">{scanResult.ticket?.ticket_number}</span>
                </div>
                <div className="h-px bg-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Used at</span>
                  <span className="text-gray-300 text-sm">
                    {scanResult.ticket?.scanned_at
                      ? new Date(scanResult.ticket.scanned_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
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

          {/* ERROR */}
          {scanStatus === 'error' && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-amber-400 font-bold text-xl">⚠️ Invalid Ticket</p>
                  <p className="text-gray-400 text-sm">Could not validate</p>
                </div>
              </div>
              <div className="bg-gray-800 border border-amber-900 rounded-2xl p-4">
                <p className="text-gray-300 text-sm">{scanResult.message}</p>
              </div>

              <div className="border-t border-gray-800 pt-3">
                <button
                  className="w-full flex items-center justify-center gap-2 text-gray-400 text-sm hover:text-orange-400 transition-colors mb-3"
                  onClick={() => setShowManual(!showManual)}
                >
                  <Keyboard className="w-4 h-4" />
                  Enter ticket number manually
                </button>
                {showManual && (
                  <div className="space-y-2">
                    <Input
                      placeholder="e.g. HOLI-001"
                      value={manualTicket}
                      onChange={(e) => setManualTicket(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
                      className="bg-gray-800 border-gray-700 text-white text-center text-base h-11 font-mono tracking-wider placeholder:text-gray-600"
                      autoFocus
                    />
                    <Button
                      className="w-full h-11 font-semibold"
                      onClick={handleManualSubmit}
                      disabled={!manualTicket.trim()}
                    >
                      <Ticket className="w-4 h-4" />
                      Validate Ticket
                    </Button>
                  </div>
                )}
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
