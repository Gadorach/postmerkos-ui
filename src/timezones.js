const rule = (month, week, weekday, hour, minute = 0) => ({ month, week, weekday, hour, minute });
const northAmericanDst = standard => ({
	enabled: true,
	offset_minutes: standard + 60,
	start: rule(3, 2, 0, 2),
	end: rule(11, 1, 0, 2),
});
const europeanDst = standard => ({
	enabled: true,
	offset_minutes: standard + 60,
	start: rule(3, 5, 0, 1 + standard / 60),
	end: rule(10, 5, 0, 1 + (standard + 60) / 60),
});
const australianDst = standard => ({
	enabled: true,
	offset_minutes: standard + 60,
	start: rule(10, 1, 0, 2),
	end: rule(4, 1, 0, 3),
});
const newZealandDst = standard => ({
	enabled: true,
	offset_minutes: standard + 60,
	start: rule(9, 5, 0, 2),
	end: rule(4, 1, 0, 3),
});
const lordHoweDst = standard => ({
	enabled: true,
	offset_minutes: standard + 30,
	start: rule(10, 1, 0, 2),
	end: rule(4, 1, 0, 2),
});
const fixed = standard => ({
	enabled: false,
	offset_minutes: standard + 60,
	start: rule(3, 2, 0, 2),
	end: rule(11, 1, 0, 2),
});
const zone = (id, label, offset, dst = fixed(offset)) => ({ id, label, standard_offset_minutes: offset, dst });

export const TIMEZONE_GROUPS = [
	{ label: 'UTC and Atlantic', zones: [
		zone('Etc/UTC', 'UTC — Coordinated Universal Time', 0),
		zone('Atlantic/Azores', 'Azores', -60, europeanDst(-60)),
		zone('Atlantic/Cape_Verde', 'Cape Verde', -60),
		zone('Atlantic/Reykjavik', 'Iceland', 0),
		zone('Atlantic/Canary', 'Canary Islands', 0, europeanDst(0)),
	] },
	{ label: 'Canada and United States', zones: [
		zone('Pacific/Honolulu', 'Hawaii', -600),
		zone('America/Anchorage', 'Alaska', -540, northAmericanDst(-540)),
		zone('America/Los_Angeles', 'Pacific — Los Angeles / Seattle', -480, northAmericanDst(-480)),
		zone('America/Vancouver', 'Pacific — Vancouver', -480, northAmericanDst(-480)),
		zone('America/Whitehorse', 'Yukon', -420),
		zone('America/Denver', 'Mountain — Denver', -420, northAmericanDst(-420)),
		zone('America/Edmonton', 'Mountain — Edmonton', -420, northAmericanDst(-420)),
		zone('America/Phoenix', 'Arizona', -420),
		zone('America/Chicago', 'Central — Chicago', -360, northAmericanDst(-360)),
		zone('America/Winnipeg', 'Central — Winnipeg', -360, northAmericanDst(-360)),
		zone('America/Regina', 'Saskatchewan', -360),
		zone('America/New_York', 'Eastern — New York', -300, northAmericanDst(-300)),
		zone('America/Toronto', 'Eastern — Toronto', -300, northAmericanDst(-300)),
		zone('America/Iqaluit', 'Eastern — Iqaluit', -300, northAmericanDst(-300)),
		zone('America/Halifax', 'Atlantic — Halifax', -240, northAmericanDst(-240)),
		zone('America/Moncton', 'Atlantic — Moncton', -240, northAmericanDst(-240)),
		zone('America/Goose_Bay', 'Atlantic — Goose Bay', -240, northAmericanDst(-240)),
		zone('America/St_Johns', 'Newfoundland — St. John’s', -210, northAmericanDst(-210)),
	] },
	{ label: 'Mexico, Central America, and Caribbean', zones: [
		zone('America/Tijuana', 'Tijuana', -480, northAmericanDst(-480)),
		zone('America/Mexico_City', 'Mexico City', -360),
		zone('America/Guatemala', 'Guatemala', -360),
		zone('America/Costa_Rica', 'Costa Rica', -360),
		zone('America/Panama', 'Panama', -300),
		zone('America/Havana', 'Cuba', -300, northAmericanDst(-300)),
		zone('America/Jamaica', 'Jamaica', -300),
		zone('America/Puerto_Rico', 'Puerto Rico', -240),
		zone('America/Santo_Domingo', 'Dominican Republic', -240),
	] },
	{ label: 'South America', zones: [
		zone('America/Bogota', 'Bogotá', -300),
		zone('America/Lima', 'Lima', -300),
		zone('America/Guayaquil', 'Ecuador', -300),
		zone('America/Caracas', 'Caracas', -240),
		zone('America/La_Paz', 'La Paz', -240),
		zone('America/Guyana', 'Guyana', -240),
		zone('America/Manaus', 'Manaus', -240),
		zone('America/Sao_Paulo', 'São Paulo / Brasília', -180),
		zone('America/Argentina/Buenos_Aires', 'Buenos Aires', -180),
		zone('America/Montevideo', 'Montevideo', -180),
		zone('America/Santiago', 'Santiago', -240),
	] },
	{ label: 'Western and Central Europe', zones: [
		zone('Europe/London', 'London', 0, europeanDst(0)),
		zone('Europe/Dublin', 'Dublin', 0, europeanDst(0)),
		zone('Europe/Lisbon', 'Lisbon', 0, europeanDst(0)),
		zone('Europe/Paris', 'Paris', 60, europeanDst(60)),
		zone('Europe/Berlin', 'Berlin', 60, europeanDst(60)),
		zone('Europe/Madrid', 'Madrid', 60, europeanDst(60)),
		zone('Europe/Rome', 'Rome', 60, europeanDst(60)),
		zone('Europe/Amsterdam', 'Amsterdam', 60, europeanDst(60)),
		zone('Europe/Brussels', 'Brussels', 60, europeanDst(60)),
		zone('Europe/Zurich', 'Zurich', 60, europeanDst(60)),
		zone('Europe/Vienna', 'Vienna', 60, europeanDst(60)),
		zone('Europe/Prague', 'Prague', 60, europeanDst(60)),
		zone('Europe/Warsaw', 'Warsaw', 60, europeanDst(60)),
		zone('Europe/Stockholm', 'Stockholm', 60, europeanDst(60)),
		zone('Europe/Oslo', 'Oslo', 60, europeanDst(60)),
		zone('Europe/Copenhagen', 'Copenhagen', 60, europeanDst(60)),
	] },
	{ label: 'Eastern Europe', zones: [
		zone('Europe/Athens', 'Athens', 120, europeanDst(120)),
		zone('Europe/Helsinki', 'Helsinki', 120, europeanDst(120)),
		zone('Europe/Bucharest', 'Bucharest', 120, europeanDst(120)),
		zone('Europe/Sofia', 'Sofia', 120, europeanDst(120)),
		zone('Europe/Kyiv', 'Kyiv', 120, europeanDst(120)),
		zone('Europe/Riga', 'Riga', 120, europeanDst(120)),
		zone('Europe/Tallinn', 'Tallinn', 120, europeanDst(120)),
		zone('Europe/Vilnius', 'Vilnius', 120, europeanDst(120)),
		zone('Europe/Istanbul', 'Istanbul', 180),
		zone('Europe/Moscow', 'Moscow', 180),
	] },
	{ label: 'Africa', zones: [
		zone('Africa/Accra', 'Accra', 0),
		zone('Africa/Casablanca', 'Casablanca', 60),
		zone('Africa/Algiers', 'Algiers', 60),
		zone('Africa/Lagos', 'Lagos', 60),
		zone('Africa/Cairo', 'Cairo', 120),
		zone('Africa/Johannesburg', 'Johannesburg', 120),
		zone('Africa/Maputo', 'Maputo', 120),
		zone('Africa/Harare', 'Harare', 120),
		zone('Africa/Nairobi', 'Nairobi', 180),
		zone('Africa/Addis_Ababa', 'Addis Ababa', 180),
	] },
	{ label: 'Middle East', zones: [
		zone('Asia/Jerusalem', 'Jerusalem', 120),
		zone('Asia/Beirut', 'Beirut', 120),
		zone('Asia/Amman', 'Amman', 180),
		zone('Asia/Baghdad', 'Baghdad', 180),
		zone('Asia/Riyadh', 'Riyadh', 180),
		zone('Asia/Tehran', 'Tehran', 210),
		zone('Asia/Dubai', 'Dubai / Abu Dhabi', 240),
		zone('Asia/Muscat', 'Muscat', 240),
	] },
	{ label: 'South and Central Asia', zones: [
		zone('Asia/Kabul', 'Kabul', 270),
		zone('Asia/Karachi', 'Karachi', 300),
		zone('Asia/Tashkent', 'Tashkent', 300),
		zone('Asia/Kolkata', 'India — Kolkata / Delhi / Mumbai', 330),
		zone('Asia/Colombo', 'Colombo', 330),
		zone('Asia/Kathmandu', 'Kathmandu', 345),
		zone('Asia/Dhaka', 'Dhaka', 360),
		zone('Asia/Almaty', 'Almaty', 300),
	] },
	{ label: 'East and Southeast Asia', zones: [
		zone('Asia/Yangon', 'Yangon', 390),
		zone('Asia/Bangkok', 'Bangkok', 420),
		zone('Asia/Ho_Chi_Minh', 'Ho Chi Minh City', 420),
		zone('Asia/Jakarta', 'Jakarta', 420),
		zone('Asia/Singapore', 'Singapore', 480),
		zone('Asia/Kuala_Lumpur', 'Kuala Lumpur', 480),
		zone('Asia/Manila', 'Manila', 480),
		zone('Asia/Hong_Kong', 'Hong Kong', 480),
		zone('Asia/Shanghai', 'China — Shanghai / Beijing', 480),
		zone('Asia/Taipei', 'Taipei', 480),
		zone('Asia/Tokyo', 'Tokyo', 540),
		zone('Asia/Seoul', 'Seoul', 540),
	] },
	{ label: 'Australia and Pacific', zones: [
		zone('Australia/Perth', 'Perth', 480),
		zone('Australia/Eucla', 'Eucla', 525),
		zone('Australia/Darwin', 'Darwin', 570),
		zone('Australia/Adelaide', 'Adelaide', 570, australianDst(570)),
		zone('Australia/Brisbane', 'Brisbane', 600),
		zone('Australia/Sydney', 'Sydney', 600, australianDst(600)),
		zone('Australia/Melbourne', 'Melbourne', 600, australianDst(600)),
		zone('Australia/Hobart', 'Hobart', 600, australianDst(600)),
		zone('Australia/Lord_Howe', 'Lord Howe Island', 630, lordHoweDst(630)),
		zone('Pacific/Guam', 'Guam', 600),
		zone('Pacific/Port_Moresby', 'Port Moresby', 600),
		zone('Pacific/Noumea', 'Nouméa', 660),
		zone('Pacific/Fiji', 'Fiji', 720),
		zone('Pacific/Auckland', 'Auckland', 720, newZealandDst(720)),
		zone('Pacific/Chatham', 'Chatham Islands', 765, { ...newZealandDst(765), offset_minutes: 825 }),
		zone('Pacific/Tahiti', 'Tahiti', -600),
		zone('Pacific/Kiritimati', 'Kiritimati', 840),
	] },
];

export const COMMON_TIMEZONES = TIMEZONE_GROUPS.flatMap(group => group.zones);

export function findTimezone(id) {
	return COMMON_TIMEZONES.find(item => item.id === id) ?? null;
}

export function applyTimezonePolicy(policy, timezoneId) {
	const selected = findTimezone(timezoneId);
	if (!selected) return { ...policy, timezone: 'custom' };
	return {
		...policy,
		timezone: selected.id,
		standard_offset_minutes: selected.standard_offset_minutes,
		dst: structuredClone(selected.dst),
	};
}
