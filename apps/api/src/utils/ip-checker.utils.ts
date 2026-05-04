/**
 * Normalize IPv6 address by expanding :: notation and converting to full form
 * @param ipv6 - IPv6 address (e.g., "2001:db8::1" or "::1")
 * @returns Normalized IPv6 address with all 8 hextets
 */
function normalizeIPv6(ipv6: string): string {
	ipv6 = ipv6.trim();
	const parts = ipv6.split(':');
	const doubleColonIndex = ipv6.indexOf('::');

	if (doubleColonIndex !== -1) {
		const leftParts = ipv6.slice(0, doubleColonIndex).split(':').filter(Boolean);
		const rightParts = ipv6.slice(doubleColonIndex + 2).split(':').filter(Boolean);
		const missingParts = 8 - leftParts.length - rightParts.length;
		const expanded = [...leftParts, ...Array(missingParts).fill('0'), ...rightParts];
		return expanded.map((part) => part.padStart(4, '0')).join(':');
	}

	return parts.map((part) => part.padStart(4, '0')).join(':');
}

/**
 * Check if two IP addresses are in the same subnet
 * - IPv4: /24 subnet (first 3 octets)
 * - IPv6: /64 subnet (first 4 hextets)
 */
export function areSameSubnet(ip1: string, ip2: string): boolean {
	try {
		const isIPv4_1 = ip1.includes('.') && !ip1.includes(':');
		const isIPv4_2 = ip2.includes('.') && !ip2.includes(':');

		if (isIPv4_1 && isIPv4_2) {
			const parts1 = ip1.split('.');
			const parts2 = ip2.split('.');
			if (parts1.length !== 4 || parts2.length !== 4) return false;
			return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2];
		}

		const isIPv6_1 = ip1.includes(':');
		const isIPv6_2 = ip2.includes(':');

		if (isIPv6_1 && isIPv6_2) {
			const normalized1 = normalizeIPv6(ip1);
			const normalized2 = normalizeIPv6(ip2);
			const parts1 = normalized1.split(':');
			const parts2 = normalized2.split(':');
			if (parts1.length !== 8 || parts2.length !== 8) return false;
			return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2] && parts1[3] === parts2[3];
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Check if an IP address matches a whitelist entry
 */
export function isIPWhitelisted(ip: string, whitelistEntry: string): boolean {
	const isIPv6Client = ip.includes(':');
	const isIPv6Whitelist = whitelistEntry.includes(':');

	if (isIPv6Client && isIPv6Whitelist) {
		try {
			return normalizeIPv6(ip) === normalizeIPv6(whitelistEntry);
		} catch {
			return false;
		}
	}

	return ip === whitelistEntry;
}

/**
 * Check if domain matches a whitelist entry
 * Supports exact match and wildcard subdomains
 */
export function isDomainWhitelisted(requestOrigin: string, whitelistEntry: string): boolean {
	let domain: string;
	try {
		domain = new URL(requestOrigin).hostname;
	} catch {
		domain = requestOrigin;
	}

	if (domain === whitelistEntry) return true;
	if (whitelistEntry.startsWith('*.')) {
		const baseDomain = whitelistEntry.slice(2);
		return domain.endsWith(`.${baseDomain}`) || domain === baseDomain;
	}
	return false;
}
