import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE) {
	throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
}

// Service role for seeding (bypasses most RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
	auth: { persistSession: false },
})

type ProblemRow = {
	title: string
	description: string
	category: string
	location: string
	country_code: string | null
}

type UserRow = {
	display_name: string
}

type ProblemInserted = { id: string; title: string; country_code: string | null }
type UserInserted = { id: string; display_name: string | null }

// Simple deterministic RNG (repeatable seeds)
function xorshift32(seed = 123456789) {
	let x = seed | 0
	return () => {
		x ^= x << 13
		x ^= x >>> 17
		x ^= x << 5
		// Convert to [0,1)
		return (x >>> 0) / 0xffffffff
	}
}

function pick<T>(arr: T[], rnd: () => number): T {
	return arr[Math.floor(rnd() * arr.length)]
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
	const a = arr.slice()
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1))
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

async function deleteAll() {
	// PostgREST requires a filter to delete. This filter matches all non-null UUIDs.
	const all = '00000000-0000-0000-0000-000000000000'

	// Order matters (FK constraints)
	let r = await supabase.from('problem_matches').delete().neq('id', all)
	if (r.error) throw r.error

	r = await supabase.from('users').delete().neq('id', all)
	if (r.error) throw r.error

	r = await supabase.from('problems').delete().neq('id', all)
	if (r.error) throw r.error
}

async function insertProblems(): Promise<ProblemInserted[]> {
	const problems: ProblemRow[] = [
		// Europe
		{
			title: 'Food waste in cities',
			description: 'Redistribute surplus edible food from shops to communities.',
			category: 'Sustainability',
			location: 'Paris, FR',
			country_code: 'FR',
		},
		{
			title: 'Night transport safety',
			description: 'Reporting + safer route guidance for late-night riders.',
			category: 'Safety',
			location: 'Madrid, ES',
			country_code: 'ES',
		},
		{
			title: 'Housing affordability',
			description: 'Tools for tenants to find fair rents and support programs.',
			category: 'Housing',
			location: 'Lisbon, PT',
			country_code: 'PT',
		},
		{
			title: 'Digital skills gap',
			description: 'Upskilling program for adults shifting careers.',
			category: 'Education',
			location: 'Berlin, DE',
			country_code: 'DE',
		},
		{
			title: 'Urban air quality alerts',
			description: 'Neighborhood-level alerts + mitigation recommendations.',
			category: 'Environment',
			location: 'Milan, IT',
			country_code: 'IT',
		},
		{
			title: 'Accessible sidewalks',
			description: 'Map and prioritize broken curb ramps & sidewalks.',
			category: 'Accessibility',
			location: 'Dublin, IE',
			country_code: 'IE',
		},
		{
			title: 'Elder loneliness',
			description: 'Match volunteers with seniors for weekly calls/visits.',
			category: 'Health',
			location: 'Amsterdam, NL',
			country_code: 'NL',
		},
		{
			title: 'Student mental health',
			description: 'Peer support + triage pathways to professional care.',
			category: 'Health',
			location: 'London, GB',
			country_code: 'GB',
		},
		{
			title: 'Recycling confusion',
			description: 'Clear local rules + scan-to-sort guidance.',
			category: 'Sustainability',
			location: 'Copenhagen, DK',
			country_code: 'DK',
		},

		// Americas
		{
			title: 'Access to mental health resources',
			description: 'Reduce wait times with triage + community support model.',
			category: 'Health',
			location: 'Seattle, US',
			country_code: 'US',
		},
		{
			title: 'Water quality monitoring',
			description: 'Low-cost testing + incident reporting for rivers.',
			category: 'Environment',
			location: 'Bogotá, CO',
			country_code: 'CO',
		},
		{
			title: 'Job readiness for youth',
			description: 'Mentorship + apprenticeship matching for first jobs.',
			category: 'Education',
			location: 'Mexico City, MX',
			country_code: 'MX',
		},
		{
			title: 'Food deserts',
			description: 'Local supply routing to underserved neighborhoods.',
			category: 'Health',
			location: 'Detroit, US',
			country_code: 'US',
		},
		{
			title: 'Disaster response coordination',
			description: 'Volunteer coordination + resource inventory during storms.',
			category: 'Safety',
			location: 'Miami, US',
			country_code: 'US',
		},
		{
			title: 'Public school supplies',
			description: 'Donations + distribution tracking for classrooms.',
			category: 'Education',
			location: 'Austin, US',
			country_code: 'US',
		},

		// Asia / Africa / Oceania (for variety)
		{
			title: 'Heatwave readiness',
			description: 'Cooling centers map + SMS alerts for vulnerable residents.',
			category: 'Safety',
			location: 'Delhi, IN',
			country_code: 'IN',
		},
		{
			title: 'Access to clean water points',
			description: 'Map broken pumps + coordinate repairs.',
			category: 'Environment',
			location: 'Nairobi, KE',
			country_code: 'KE',
		},
		{
			title: 'Community health navigation',
			description: 'Help residents find clinics and understand services.',
			category: 'Health',
			location: 'Cape Town, ZA',
			country_code: 'ZA',
		},
		{
			title: 'Wildfire smoke guidance',
			description: 'Indoor air tips + mask availability map.',
			category: 'Environment',
			location: 'Sydney, AU',
			country_code: 'AU',
		},
		{
			title: 'Language access in services',
			description: 'Translate key service steps and provide interpretation links.',
			category: 'Accessibility',
			location: 'Tokyo, JP',
			country_code: 'JP',
		},
	]

	const { data, error } = await supabase.from('problems').insert(problems).select('id,title,country_code')

	if (error) throw error
	return (data ?? []) as ProblemInserted[]
}

async function insertUsers(count = 30): Promise<UserInserted[]> {
	const names = [
		'Alex',
		'Sam',
		'Jordan',
		'Taylor',
		'Morgan',
		'Riley',
		'Casey',
		'Jamie',
		'Avery',
		'Quinn',
		'Cameron',
		'Dakota',
		'Emerson',
		'Finley',
		'Harper',
		'Hayden',
		'Jules',
		'Kai',
		'Logan',
		'Parker',
		'Reese',
		'Rowan',
		'Skyler',
		'Spencer',
		'Tatum',
		'Blake',
		'Drew',
		'Elliot',
		'Marley',
		'Noa',
		'Sasha',
		'Val',
		'Charlie',
		'Robin',
		'Kris',
	]

	const rnd = xorshift32(42)
	const users: UserRow[] = []

	for (let i = 0; i < count; i++) {
		const base = pick(names, rnd)
		users.push({ display_name: `${base} ${String(i + 1).padStart(2, '0')}` })
	}

	const { data, error } = await supabase.from('users').insert(users).select('id,display_name')

	if (error) throw error
	return (data ?? []) as UserInserted[]
}

async function insertMatches(users: UserInserted[], problems: ProblemInserted[]) {
	const rnd = xorshift32(2026)

	// Each user links to 3..7 problems
	const minLinks = 3
	const maxLinks = 7

	const roles = ['SOLVER', 'AFFECTED'] as const

	const rows: Array<{
		user_id: string
		problem_id: string
		role: (typeof roles)[number]
	}> = []

	const used = new Set<string>() // `${user_id}:${problem_id}` to respect UNIQUE(user_id, problem_id)

	for (const u of users) {
		const linkCount = Math.floor(rnd() * (maxLinks - minLinks + 1)) + minLinks
		const chosen = shuffle(problems, rnd).slice(0, linkCount)

		for (const p of chosen) {
			const key = `${u.id}:${p.id}`
			if (used.has(key)) continue
			used.add(key)

			// Slight bias: more SOLVER than AFFECTED (you can tweak)
			const role = rnd() < 0.65 ? 'SOLVER' : 'AFFECTED'
			rows.push({ user_id: u.id, problem_id: p.id, role })
		}
	}

	// Insert in batches
	const batchSize = 500
	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize)
		const { error } = await supabase.from('problem_matches').insert(batch)
		if (error) throw error
	}

	return rows.length
}

async function main() {
	console.log('Seeding started...')

	console.log('1) Deleting existing data...')
	await deleteAll()

	console.log('2) Inserting problems...')
	const problems = await insertProblems()
	console.log(`   inserted problems: ${problems.length}`)

	console.log('3) Inserting users...')
	const users = await insertUsers(40)
	console.log(`   inserted users: ${users.length}`)

	console.log('4) Inserting matches...')
	const matchCount = await insertMatches(users, problems)
	console.log(`   inserted problem_matches: ${matchCount}`)

	// Quick sanity checks: top problems by collaborator count
	const { data: top, error } = await supabase.from('problem_matches').select('problem_id, problems!inner(title)').limit(1) // just to validate join availability

	if (error) {
		console.log('   (join check) warning:', error.message)
	} else {
		console.log('   (join check) ok')
	}

	console.log('Seeding complete ✅')
}

main().catch(e => {
	console.error('Seed failed:', e)
	process.exit(1)
})
