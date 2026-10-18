import { useEffect, useState, useRef } from 'react';
import { EVENTS } from '../utils/constants';

/**
 * Custom hook to estimate clock offset between client and server
 * Uses ping/pong to measure round-trip time and calculate offset
 *
 * Why we need this:
 * - Server timestamp: 1000.0 seconds
 * - Client calculates elapsed: Date.now() - room.updatedAt
 * - But if client clock is 2 seconds ahead, calculation is wrong!
 * - We measure the offset and adjust our calculations
 */
export function useClockOffset(socket) {
  const [offset, setOffset] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const samplesRef = useRef([]);

  useEffect(() => {
    if (!socket) return;

    // Collect multiple samples for accuracy
    const SAMPLE_COUNT = 5;
    let samplesTaken = 0;

    const handlePong = ({ clientTime, serverTime }) => {
      const now = Date.now();
      const roundTripTime = now - clientTime;

      // Estimate one-way latency (half of round-trip)
      const oneWayLatency = roundTripTime / 2;

      // Calculate offset: server time when it sent pong - our time when we think it sent
      // If positive: server is ahead of us
      // If negative: we are ahead of server
      const estimatedServerTime = serverTime;
      const estimatedClientTime = clientTime + oneWayLatency;
      const sampleOffset = estimatedServerTime - estimatedClientTime;

      console.log(`Clock sync sample ${samplesTaken + 1}:`, {
        roundTripTime: roundTripTime.toFixed(2) + 'ms',
        oneWayLatency: oneWayLatency.toFixed(2) + 'ms',
        offset: sampleOffset.toFixed(2) + 'ms'
      });

      samplesRef.current.push({
        offset: sampleOffset,
        rtt: roundTripTime
      });

      samplesTaken++;

      if (samplesTaken >= SAMPLE_COUNT) {
        // Calculate median offset from samples
        // We use the sample with the LOWEST RTT (fastest network response)
        // because it's least likely to have network jitter
        const bestSample = samplesRef.current.reduce((best, current) =>
          current.rtt < best.rtt ? current : best
        );

        console.log('✓ Clock offset calibrated:', bestSample.offset.toFixed(2) + 'ms');
        setOffset(bestSample.offset);
        setIsCalibrated(true);

        // Clean up
        socket.off(EVENTS.PONG, handlePong);
      } else {
        // Take next sample after a short delay
        setTimeout(() => {
          socket.emit(EVENTS.PING, { clientTime: Date.now() });
        }, 200);
      }
    };

    socket.on(EVENTS.PONG, handlePong);

    // Start the calibration process
    console.log('Starting clock offset calibration...');
    socket.emit(EVENTS.PING, { clientTime: Date.now() });

    return () => {
      socket.off(EVENTS.PONG, handlePong);
    };
  }, [socket]);

  /**
   * Get the current server time (adjusted for offset)
   */
  const getServerTime = () => {
    return Date.now() + offset;
  };

  return {
    offset,
    isCalibrated,
    getServerTime
  };
}
