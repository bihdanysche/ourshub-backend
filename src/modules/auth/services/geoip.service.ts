import { Injectable } from '@nestjs/common';
import geoip from 'geoip-lite';

@Injectable()
export class GeoIpService {
  lookupLocation(ip: string): string | null {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
      return null;
    }

    try {
      const geo = geoip.lookup(ip);
      if (!geo) {
        return null;
      }
      if (geo.city && geo.country) {
        return `${geo.city}, ${geo.country}`;
      }
      return geo.country || null;
    } catch {
      return null;
    }
  }
}
