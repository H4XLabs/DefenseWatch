"""Port scan detection — tracks IPs hitting multiple distinct service ports."""

import time
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from defensewatch.config import DetectionConfig

logger = logging.getLogger(__name__)


@dataclass
class PortScanEvent:
    source_ip: str
    detected_at: float
    ports_hit: list[int]
    port_count: int
    window_seconds: int
    status: str = "active"


class PortScanTracker:
    """Detects port scanning by tracking distinct service ports an IP connects to."""

    def __init__(self, config: DetectionConfig):
        self.threshold = config.portscan_threshold
        self.window = config.portscan_window_seconds
        # ip -> [(timestamp, port), ...]
        self._hits: dict[str, list[tuple[float, int]]] = defaultdict(list)
        # ip -> timestamp of last alert; allows re-alerting after one full window
        self._alerted: dict[str, float] = {}

    def track(self, ip: str, port: int, timestamp: float) -> PortScanEvent | None:
        """Record a port hit. Returns a PortScanEvent if scan threshold is reached.

        An IP can trigger repeated alerts, but no more than once per window period.
        """
        if port is None:
            return None

        hits = self._hits[ip]
        hits.append((timestamp, port))

        # Prune hits older than the window
        cutoff = timestamp - self.window
        self._hits[ip] = [(t, p) for t, p in hits if t >= cutoff]
        hits = self._hits[ip]

        # Count distinct ports within the window
        distinct_ports = sorted(set(p for _, p in hits))

        # Alert if threshold reached and at least one full window has passed
        # since the last alert for this IP (prevents duplicate events for the
        # same scan burst while still allowing detection of repeated scanners).
        last_alert = self._alerted.get(ip, 0.0)
        if len(distinct_ports) >= self.threshold and (timestamp - last_alert) >= self.window:
            self._alerted[ip] = timestamp
            return PortScanEvent(
                source_ip=ip,
                detected_at=timestamp,
                ports_hit=distinct_ports,
                port_count=len(distinct_ports),
                window_seconds=self.window,
            )

        return None

    def cleanup(self):
        """Remove stale tracking data and expired alert cooldowns."""
        now = time.time()
        cutoff = now - self.window
        stale = []
        for ip, hits in self._hits.items():
            self._hits[ip] = [(t, p) for t, p in hits if t >= cutoff]
            if not self._hits[ip]:
                stale.append(ip)
        for ip in stale:
            del self._hits[ip]
        # Expire alert cooldowns older than one window so silent IPs can be
        # re-detected if they resume scanning later.
        stale_alerted = [ip for ip, t in self._alerted.items() if now - t >= self.window]
        for ip in stale_alerted:
            del self._alerted[ip]
